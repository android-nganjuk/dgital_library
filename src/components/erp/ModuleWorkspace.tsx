import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Code2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  ErpModuleDefinition,
  ErpMutationAction,
  ErpSubView,
} from '../../data/erpModules';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatNumberId,
  type NormalizedApiPayload,
} from '../../lib/formatters';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { IdentityShowcase } from './IdentityShowcase';
import { SmartDataTable, type InspectedEntity } from './SmartDataTable';
import { DigitalBookReaderModal } from './DigitalBookReaderModal';
import { PegawaiJabatanDashboard } from './PegawaiJabatanDashboard';
import {
  PegawaiJabatanFormPopup,
  PegawaiJabatanManagerPopup,
  type ManagedEmployeeTarget,
  type PegawaiJabatanPopupState,
} from './PegawaiJabatanModal';

interface AlumniYearOption {
  value: string;
  label: string;
}

interface ModuleWorkspaceProps {
  module: ErpModuleDefinition;
  initialViewId?: string;
  isLandlord?: boolean;
  onInspectEntity: (entity: InspectedEntity) => void;
  onTriggerMutation: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  onMutated?: () => void;
  refreshSignal: number;
}

export function ModuleWorkspace({
  module,
  initialViewId,
  isLandlord = false,
  onInspectEntity,
  onTriggerMutation,
  onMutated,
  refreshSignal,
}: ModuleWorkspaceProps) {
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    if (initialViewId && module.views.some((v) => v.id === initialViewId)) {
      return initialViewId;
    }
    return module.views[0]?.id || '';
  });
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [appliedParams, setAppliedParams] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState<NormalizedApiPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvedEndpointUrl, setResolvedEndpointUrl] = useState<string>('');
  const [readingBook, setReadingBook] = useState<Record<string, unknown> | null>(
    null
  );
  const [alumniYearOptions, setAlumniYearOptions] = useState<AlumniYearOption[]>(
    []
  );
  const [managedPegawaiJabatan, setManagedPegawaiJabatan] =
    useState<ManagedEmployeeTarget | null>(null);
  const [quickPegawaiJabatanPopup, setQuickPegawaiJabatanPopup] =
    useState<PegawaiJabatanPopupState | null>(null);

  // Reset atau arahkan sub-view ketika berpindah modul utama / pintasan spesifik
  useEffect(() => {
    if (initialViewId && module.views.some((v) => v.id === initialViewId)) {
      setActiveViewId(initialViewId);
      return;
    }
    const firstView = module.views[0];
    if (firstView) {
      setActiveViewId(firstView.id);
    }
  }, [module.id, module.views, initialViewId]);

  const activeView: ErpSubView | undefined = useMemo(
    () =>
      module.views.find((v) => v.id === activeViewId) || module.views[0],
    [module.views, activeViewId]
  );

  // Inisialisasi nilai parameter default saat sub-view berganti
  useEffect(() => {
    if (!activeView) {
      return;
    }
    const defaults: Record<string, string> = {};
    for (const p of activeView.params || []) {
      defaults[p.name] = p.defaultValue ?? '';
    }
    setParamValues(defaults);
    setAppliedParams(defaults);
  }, [activeView]);

  const fetchActiveEndpoint = useCallback(
    async (view: ErpSubView, currentParams: Record<string, string>) => {
      // Validasi parameter path yang wajib diisi
      for (const p of view.params || []) {
        if (p.required && !String(currentParams[p.name] ?? '').trim()) {
          setPayload(null);
          setErrorMsg(
            `Silakan isi parameter "${p.label}" terlebih dahulu untuk memuat data.`
          );
          return;
        }
      }

      let path = view.pathTemplate;
      const queryObj: Record<string, string> = {};

      // Pastikan endpoint Direktori Pegawai SDM hanya mengambil dan merender pegawai aktif (aktif=1),
      // sedangkan tampilan khusus "Jabatan Pegawai (NIP)" merender tepat GET /api/jbssdm/pegawai?nip=...
      if (path === '/jbssdm/pegawai' && view.id !== 'pegawai-jabatan-nip') {
        queryObj.aktif = '1';
      }

      for (const p of view.params || []) {
        const val = String(currentParams[p.name] ?? '').trim();
        if (p.in === 'path') {
          path = path.replace(`:${p.name}`, encodeURIComponent(val));
        } else if (p.in === 'query' && val !== '') {
          queryObj[p.name] = val;
        }
      }

      const qs = new URLSearchParams(queryObj).toString();
      const displayUrl = `/api${path}${qs ? `?${qs}` : ''}`;
      setResolvedEndpointUrl(displayUrl);

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const response = await apiClient.get(path, {
          params: Object.keys(queryObj).length > 0 ? queryObj : undefined,
        });
        const normalized = extractResponsePayload(response.data);
        if (path === '/jbssdm/pegawai' && view.id !== 'pegawai-jabatan-nip') {
          const activeRows = normalized.rows.filter(
            (r) => !('aktif' in r) || Number(r.aktif) === 1
          );
          setPayload({
            ...normalized,
            rows: activeRows,
            totalCount: activeRows.length,
          });
        } else if (view.id === 'riwayat-baca-digital' && queryObj.nis) {
          const targetNis = queryObj.nis.trim().toLowerCase();
          const filtered = normalized.rows.filter(
            (r) => String(r.nis ?? '').trim().toLowerCase() === targetNis
          );
          setPayload({
            ...normalized,
            rows: filtered,
            totalCount: filtered.length,
          });
        } else {
          setPayload(normalized);
        }
      } catch (err) {
        setPayload(null);
        setErrorMsg(extractApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!activeView || activeView.id === 'riwayat-jabatan') {
      return;
    }
    fetchActiveEndpoint(activeView, appliedParams);
  }, [activeView, appliedParams, refreshSignal, fetchActiveEndpoint]);

  // Muat daftar pilihan cepat Tahun Ajaran untuk tampilan Data Alumni (/jbsakad/alumni)
  useEffect(() => {
    if (activeView?.pathTemplate !== '/jbsakad/alumni') {
      return;
    }
    let cancelled = false;

    Promise.allSettled([
      apiClient.get('/jbsakad/alumni'),
      apiClient.get('/jbsakad/tahunajaran'),
    ]).then(([alumniRes, taRes]) => {
      if (cancelled) return;

      const countByYear = new Map<string, number>();
      if (alumniRes.status === 'fulfilled') {
        const rows = extractResponsePayload(alumniRes.value.data).rows;
        for (const r of rows) {
          const yr = String(r.nama_tahunajaran || '').trim();
          if (yr) {
            countByYear.set(yr, (countByYear.get(yr) || 0) + 1);
          }
        }
      }

      if (taRes.status === 'fulfilled') {
        const taRows = extractResponsePayload(taRes.value.data).rows;
        for (const r of taRows) {
          const yr = String(r.tahunajaran || '').trim();
          if (yr && !countByYear.has(yr)) {
            countByYear.set(yr, 0);
          }
        }
      }

      const sortedYears = Array.from(countByYear.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([yr, count]) => ({
          value: yr,
          label:
            count > 0
              ? `${yr} (${formatNumberId(count)} alumni)`
              : yr,
        }));

      setAlumniYearOptions(sortedYears);
    });

    return () => {
      cancelled = true;
    };
  }, [activeView?.pathTemplate, refreshSignal]);

  const handleApplyParams = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedParams({ ...paramValues });
  };

  const handleResetParams = () => {
    if (!activeView) return;
    const defaults: Record<string, string> = {};
    for (const p of activeView.params || []) {
      defaults[p.name] = p.defaultValue ?? '';
    }
    setParamValues(defaults);
    setAppliedParams(defaults);
  };

  const handleQuickReturnBook = (replid: string) => {
    const returnAction = module.mutations.find(
      (m) => m.id === 'proses-kembali-buku'
    );
    if (returnAction) {
      onTriggerMutation(returnAction, { id: replid });
    }
  };

  const handleQuickBorrowBook = (kodepustaka: string) => {
    const borrowAction = module.mutations.find(
      (m) => m.id === 'catat-pinjam-buku'
    );
    if (borrowAction) {
      onTriggerMutation(borrowAction, { kodepustaka });
    }
  };

  const linkDigitalAction = useMemo(
    () => module.mutations.find((m) => m.id === 'tautkan-pustaka-digital') ?? null,
    [module.mutations]
  );

  const logDigitalReadAction = useMemo(
    () => module.mutations.find((m) => m.id === 'catat-baca-digital') ?? null,
    [module.mutations]
  );

  const unlinkDigitalAction = useMemo(
    () => module.mutations.find((m) => m.id === 'hapus-pustaka-digital') ?? null,
    [module.mutations]
  );

  const addHakAksesAction = useMemo(
    () =>
      isLandlord
        ? module.mutations.find((m) => m.id === 'add-hakakses') ?? null
        : null,
    [isLandlord, module.mutations]
  );

  const deleteHakAksesAction = useMemo(
    () =>
      isLandlord
        ? module.mutations.find((m) => m.id === 'delete-hakakses') ?? null
        : null,
    [isLandlord, module.mutations]
  );

  const updateJabatanAction = useMemo(
    () => module.mutations.find((m) => m.id === 'update-jabatan') ?? null,
    [module.mutations]
  );

  const deleteJabatanAction = useMemo(
    () => module.mutations.find((m) => m.id === 'hapus-jabatan') ?? null,
    [module.mutations]
  );

  const buildJabatanInitialValues = (
    row: Record<string, unknown>
  ): Record<string, string> => ({
    replid: row.replid !== undefined && row.replid !== null ? String(row.replid) : '',
    jabatan: row.jabatan ? String(row.jabatan) : '',
    singkatan: row.singkatan ? String(row.singkatan) : '',
    satker:
      row.satker && String(row.satker) !== 'null'
        ? String(row.satker)
        : '(Tidak Ada)',
    eselon:
      row.eselon && String(row.eselon) !== 'null'
        ? String(row.eselon)
        : '(Tidak Ada)',
    rootid:
      row.rootid !== undefined && row.rootid !== null ? String(row.rootid) : '',
  });

  const handleLinkDigitalBook = (row: Record<string, unknown>) => {
    if (!linkDigitalAction) return;
    const idPustaka = String(
      row.idpustaka ?? row.id_pustaka ?? row.replid ?? ''
    ).trim();
    const existingUrl =
      row.file_url && String(row.file_url) !== 'null'
        ? String(row.file_url).trim()
        : '';
    const formatUpper = String(row.tipe || row.format || '').trim().toUpperCase();
    const defaultTipe = formatUpper === 'EPUB' ? 'EPUB' : 'PDF';

    onTriggerMutation(linkDigitalAction, {
      idpustaka: idPustaka,
      file_url: existingUrl,
      tipe: defaultTipe,
    });
  };

  const handleUnlinkDigitalBook = (row: Record<string, unknown>) => {
    if (!unlinkDigitalAction) return;
    const idPustaka = String(
      row.idpustaka ?? row.id_pustaka ?? row.replid ?? ''
    ).trim();
    onTriggerMutation(unlinkDigitalAction, {
      idpustaka: idPustaka,
    });
  };

  if ((module.id === 'jbsuser' && !isLandlord) || !activeView) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Modul & Tindakan CRUD */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>Modul {module.code}</span>
              <span aria-hidden="true">·</span>
              <span>Prefix {module.prefix}</span>
              <span aria-hidden="true">·</span>
              <span>{module.views.length} tampilan data</span>
              {module.matchedHakAkses && module.matchedHakAkses.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-700 font-semibold">
                    Akses: {module.matchedHakAkses.join(', ')}
                  </span>
                </>
              )}
            </div>
            {module.id !== 'jbsperpus' && (
              <>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  {module.name}
                </h1>
                {module.summary && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {module.summary}
                  </p>
                )}
              </>
            )}
          </div>

          {(module.mutations.length > 0 || module.id === 'jbssdm') && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {module.id === 'jbssdm' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setQuickPegawaiJabatanPopup({
                      mode: 'create',
                      nip:
                        String(
                          appliedParams.nip || paramValues.nip || '2001072003'
                        ).trim() || '2001072003',
                      allowChangeNip: true,
                    })
                  }
                >
                  <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tambah Jabatan Pegawai</span>
                </Button>
              )}
              {module.mutations.map((act) => (
                <Button
                  key={act.id}
                  type="button"
                  variant={act.destructive ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => {
                    const currentNip = String(
                      appliedParams.nip || paramValues.nip || ''
                    ).trim();
                    if (
                      act.id === 'add-hakakses' &&
                      activeView.id === 'hakakses-nip' &&
                      currentNip
                    ) {
                      onTriggerMutation(act, { nip: currentNip });
                    } else if (
                      act.id === 'update-jabatan' &&
                      activeView.id === 'jabatan-detail-sdm' &&
                      payload?.singleObject
                    ) {
                      onTriggerMutation(
                        act,
                        buildJabatanInitialValues(payload.singleObject)
                      );
                    } else if (
                      act.id === 'hapus-jabatan' &&
                      activeView.id === 'jabatan-detail-sdm'
                    ) {
                      const currentReplid = String(
                        payload?.singleObject?.replid ??
                          appliedParams.replid ??
                          paramValues.replid ??
                          ''
                      ).trim();
                      onTriggerMutation(
                        act,
                        currentReplid ? { replid: currentReplid } : undefined
                      );
                    } else {
                      onTriggerMutation(act);
                    }
                  }}
                  className={act.destructive ? 'text-red-700 border-red-200 hover:bg-red-50' : ''}
                >
                  {!act.destructive && <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{act.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Navigasi Sub-Layanan Endpoint GET */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label={`Sub-layanan ${module.name}`}
          >
            {module.views.map((view) => {
              const isActive = view.id === activeView.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveViewId(view.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Permukaan Utama Data Endpoint Aktif */}
      {activeView.id === 'riwayat-jabatan' ? (
        <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  CRUD /api/jbssdm/pegawai/:nip/jabatan
                </span>
                <span aria-hidden="true">·</span>
                <span>GET · POST · PUT · DELETE</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {activeView.label}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeView.description}
              </p>
            </div>
          </div>

          <PegawaiJabatanDashboard
            initialNip={appliedParams.nip || '2001072003'}
            refreshSignal={refreshSignal}
            onInspectEntity={onInspectEntity}
            onMutated={onMutated}
          />
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
          {/* Info Endpoint Aktif & Kontrol Refresh / JSON */}
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  GET {resolvedEndpointUrl || `/api${activeView.pathTemplate}`}
                </span>
                {payload && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium text-slate-700">
                      Total: {formatNumberId(payload.totalCount)} data
                    </span>
                  </>
                )}
                {payload?.source && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Basis Data: {payload.source}</span>
                  </>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {activeView.label}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeView.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => fetchActiveEndpoint(activeView, appliedParams)}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Muat Ulang</span>
              </Button>

              {payload && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onInspectEntity({
                      mode: 'raw-response',
                      title: `GET ${resolvedEndpointUrl}`,
                      row: (payload.raw as Record<string, unknown>) || {},
                    })
                  }
                >
                  <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Respons JSON</span>
                </Button>
              )}
            </div>
          </div>

          {/* Form Parameter Query / Path Apabila Endpoint Membutuhkan Filter */}
          {activeView.params && activeView.params.length > 0 && (
            <form
              onSubmit={handleApplyParams}
              className="px-6 py-4 bg-slate-50/70 flex flex-wrap items-end gap-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2.5 mr-1">
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Parameter Query:</span>
              </div>

              {activeView.pathTemplate === '/jbsakad/alumni' &&
                alumniYearOptions.length > 0 && (
                  <div className="w-full sm:w-60 space-y-1">
                    <label
                      htmlFor="alumni-quick-tahunajaran"
                      className="block text-xs font-medium text-slate-600"
                    >
                      Pilih Cepat Tahun Ajaran
                    </label>
                    <select
                      id="alumni-quick-tahunajaran"
                      value={
                        alumniYearOptions.some(
                          (opt) => opt.value === (paramValues.tahunajaran ?? '')
                        )
                          ? (paramValues.tahunajaran ?? '')
                          : ''
                      }
                      onChange={(e) => {
                        const selected = e.target.value;
                        setParamValues((prev) => ({
                          ...prev,
                          tahunajaran: selected,
                        }));
                        setAppliedParams((prev) => ({
                          ...prev,
                          tahunajaran: selected,
                        }));
                      }}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                    >
                      <option value="">Semua Tahun Ajaran</option>
                      {alumniYearOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {activeView.params.map((param) => (
                <div key={param.name} className="w-full sm:w-56 space-y-1">
                  <label
                    htmlFor={`param-${param.name}`}
                    className="block text-xs font-medium text-slate-600"
                  >
                    {param.label}
                    {param.required && <span className="text-red-600 ml-0.5">*</span>}
                  </label>
                  <Input
                    id={`param-${param.name}`}
                    value={paramValues[param.name] ?? ''}
                    onChange={(e) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [param.name]: e.target.value,
                      }))
                    }
                    placeholder={param.placeholder}
                    className="h-9 text-xs"
                  />
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={isLoading}>
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tampilkan</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetParams}
                  disabled={isLoading}
                >
                  Reset
                </Button>
              </div>
            </form>
          )}

          {/* Pesan Status Server (Bila Ada) */}
          {payload?.message && !errorMsg && (
            <div className="px-6 py-2.5 bg-slate-50/40 text-xs text-slate-600">
              Keterangan Server: <span className="font-medium text-slate-800">{payload.message}</span>
            </div>
          )}

          {/* Penanganan Error Endpoint */}
          {errorMsg ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                <div className="space-y-1">
                  <AlertTitle>Kendala Memuat Endpoint</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </div>
              </Alert>
            </div>
          ) : activeView.renderMode === 'identity-cards' && payload ? (
            <IdentityShowcase
              rows={payload.rows}
              onInspectRow={(row) =>
                onInspectEntity({
                  mode: 'generic',
                  title: String(row.nama || 'Identitas Lembaga'),
                  row,
                })
              }
            />
          ) : (
            <SmartDataTable
              rows={payload?.rows || []}
              singleObject={payload?.singleObject || null}
              isLoading={isLoading}
              entityType={activeView.entityType}
              onInspect={onInspectEntity}
              onQuickReturnBook={handleQuickReturnBook}
              onQuickBorrowBook={handleQuickBorrowBook}
              onOpenDigitalBook={(row) => setReadingBook(row)}
              onLinkDigitalBook={
                linkDigitalAction ? handleLinkDigitalBook : undefined
              }
              onUnlinkDigitalBook={
                unlinkDigitalAction ? handleUnlinkDigitalBook : undefined
              }
              onGrantHakAkses={
                addHakAksesAction
                  ? (nip) => onTriggerMutation(addHakAksesAction, { nip })
                  : undefined
              }
              onRevokeHakAkses={
                deleteHakAksesAction
                  ? (replid) =>
                      onTriggerMutation(deleteHakAksesAction, { replid })
                  : undefined
              }
              onEditJabatan={
                updateJabatanAction
                  ? (row) =>
                      onTriggerMutation(
                        updateJabatanAction,
                        buildJabatanInitialValues(row)
                      )
                  : undefined
              }
              onDeleteJabatan={
                deleteJabatanAction
                  ? (row) =>
                      onTriggerMutation(deleteJabatanAction, {
                        replid: String(row.replid ?? ''),
                      })
                  : undefined
              }
              onManagePegawaiJabatan={
                module.id === 'jbssdm'
                  ? (row) =>
                      setManagedPegawaiJabatan({
                        nip: String(row.nip ?? ''),
                        nama: String(
                          row.nama || row.nama_pegawai || `NIP ${String(row.nip ?? '')}`
                        ),
                        bagian:
                          row.bagian && String(row.bagian) !== 'null'
                            ? String(row.bagian)
                            : undefined,
                        jabatan:
                          row.jabatan && String(row.jabatan) !== 'null'
                            ? String(row.jabatan)
                            : undefined,
                        foto: row.foto,
                      })
                  : undefined
              }
            />
          )}
        </section>
      )}

      <DigitalBookReaderModal
        book={readingBook}
        onClose={() => setReadingBook(null)}
        onManualLogRead={
          logDigitalReadAction
            ? (idPustaka) => {
                setReadingBook(null);
                onTriggerMutation(logDigitalReadAction, { idpustaka: idPustaka });
              }
            : undefined
        }
      />

      {/* Popup Manager Jabatan Pegawai (Saat klik Kelola Jabatan dari Direktori Pegawai) */}
      <PegawaiJabatanManagerPopup
        employee={managedPegawaiJabatan}
        onClose={() => setManagedPegawaiJabatan(null)}
        onMutated={onMutated}
      />

      {/* Popup Form Cepat Tambah Jabatan Pegawai (Saat klik dari Header Modul SDM) */}
      <PegawaiJabatanFormPopup
        popupState={quickPegawaiJabatanPopup}
        onClose={() => setQuickPegawaiJabatanPopup(null)}
        onSuccess={() => {
          if (onMutated) onMutated();
        }}
        onSwitchMode={(next) => setQuickPegawaiJabatanPopup(next)}
      />
    </div>
  );
}
