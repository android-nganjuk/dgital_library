import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { ErpMutationAction } from '../../data/erpModules';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface EndpointFormModalProps {
  action: ErpMutationAction | null;
  initialValues?: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}

export function EndpointFormModal({
  action,
  initialValues,
  onClose,
  onSuccess,
}: EndpointFormModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<unknown | null>(null);
  const [jabatanUsagePreview, setJabatanUsagePreview] = useState<{
    jabatanName: string;
    singkatan: string;
    activeHolders: { nip: string; nama: string }[];
  } | null>(null);

  const isPutJabatan =
    action?.pathTemplate === '/jbssdm/jabatan/:replid' &&
    action?.method === 'PUT';
  const isDeleteJabatan =
    action?.pathTemplate === '/jbssdm/jabatan/:replid' &&
    action?.method === 'DELETE';

  useEffect(() => {
    if (!action) {
      return;
    }
    const defaults: Record<string, string> = {};
    for (const field of action.fields) {
      if (initialValues && initialValues[field.name] !== undefined) {
        defaults[field.name] = String(initialValues[field.name]);
      } else if (field.defaultValue !== undefined) {
        defaults[field.name] = String(field.defaultValue);
      } else {
        defaults[field.name] = '';
      }
    }
    setValues(defaults);
    setErrorMsg(null);
    setSuccessResult(null);
    setJabatanUsagePreview(null);
  }, [action, initialValues]);

  // Pratinjau detail jabatan & pegawai pemangku saat akan menghapus jabatan (DELETE /jbssdm/jabatan/:replid)
  useEffect(() => {
    if (!isDeleteJabatan) {
      setJabatanUsagePreview(null);
      return;
    }
    const replid = String(values.replid ?? '').trim();
    if (!replid) {
      setJabatanUsagePreview(null);
      return;
    }

    let cancelled = false;
    Promise.allSettled([
      apiClient.get(`/jbssdm/jabatan/${encodeURIComponent(replid)}`),
      apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } }),
    ]).then(([jabRes, pegRes]) => {
      if (cancelled) return;
      if (jabRes.status !== 'fulfilled') {
        setJabatanUsagePreview(null);
        return;
      }
      const jabData = (jabRes.value.data as Record<string, unknown>)?.data as
        | Record<string, unknown>
        | undefined;
      if (!jabData || typeof jabData !== 'object') {
        setJabatanUsagePreview(null);
        return;
      }

      const jabatanName = String(jabData.jabatan ?? '').trim();
      const singkatan = String(jabData.singkatan ?? '').trim();
      const activeHolders: { nip: string; nama: string }[] = [];

      if (jabatanName && pegRes.status === 'fulfilled') {
        const pegPayload = pegRes.value.data as Record<string, unknown>;
        const pegRows = Array.isArray(pegPayload?.data)
          ? (pegPayload.data as Record<string, unknown>[])
          : [];
        for (const p of pegRows) {
          if (
            String(p.jabatan ?? '').trim().toLowerCase() ===
            jabatanName.toLowerCase()
          ) {
            activeHolders.push({
              nip: String(p.nip ?? ''),
              nama: String(p.nama ?? ''),
            });
          }
        }
      }

      setJabatanUsagePreview({
        jabatanName,
        singkatan,
        activeHolders,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isDeleteJabatan, values.replid]);

  const handleLoadJabatanById = async () => {
    const replid = String(values.replid ?? '').trim();
    if (!replid) {
      setErrorMsg('Masukkan ID Jabatan (replid) terlebih dahulu untuk memuat data.');
      return;
    }
    setIsFetchingDetail(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get(
        `/jbssdm/jabatan/${encodeURIComponent(replid)}`
      );
      const dataObj = (res.data as Record<string, unknown>)?.data as
        | Record<string, unknown>
        | undefined;
      if (!dataObj || typeof dataObj !== 'object') {
        setErrorMsg(`Data jabatan dengan ID ${replid} tidak ditemukan.`);
        return;
      }
      setValues((prev) => ({
        ...prev,
        jabatan: dataObj.jabatan ? String(dataObj.jabatan) : '',
        singkatan: dataObj.singkatan ? String(dataObj.singkatan) : '',
        satker:
          dataObj.satker && String(dataObj.satker) !== 'null'
            ? String(dataObj.satker)
            : '(Tidak Ada)',
        eselon:
          dataObj.eselon && String(dataObj.eselon) !== 'null'
            ? String(dataObj.eselon)
            : '(Tidak Ada)',
        rootid:
          dataObj.rootid !== undefined && dataObj.rootid !== null
            ? String(dataObj.rootid)
            : '',
      }));
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const previewRequest = useMemo(() => {
    if (!action) {
      return { path: '', body: {} as Record<string, unknown>, hasBody: false };
    }
    let resolvedPath = action.pathTemplate;
    const bodyPayload: Record<string, unknown> = {};
    let hasBodyField = false;

    for (const field of action.fields) {
      const rawVal = String(values[field.name] ?? '').trim();
      if (field.in === 'path') {
        if (rawVal) {
          resolvedPath = resolvedPath.replace(
            `:${field.name}`,
            encodeURIComponent(rawVal)
          );
        }
      } else {
        hasBodyField = true;
        if (rawVal !== '') {
          const isNum =
            field.type === 'number' || field.valueType === 'number';
          bodyPayload[field.name] = isNum ? Number(rawVal) : rawVal;
        }
      }
    }

    return {
      path: `/api${resolvedPath}`,
      body: bodyPayload,
      hasBody: hasBodyField,
    };
  }, [action, values]);

  if (!action) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessResult(null);

    for (const field of action.fields) {
      if (field.required && !String(values[field.name] ?? '').trim()) {
        setErrorMsg(`Kolom "${field.label}" wajib diisi.`);
        return;
      }
    }

    let resolvedPath = action.pathTemplate;
    const bodyPayload: Record<string, unknown> = {};

    for (const field of action.fields) {
      const rawVal = String(values[field.name] ?? '').trim();
      if (field.in === 'path') {
        resolvedPath = resolvedPath.replace(
          `:${field.name}`,
          encodeURIComponent(rawVal)
        );
      } else if (rawVal !== '') {
        const isNum = field.type === 'number' || field.valueType === 'number';
        bodyPayload[field.name] = isNum ? Number(rawVal) : rawVal;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.request({
        method: action.method,
        url: resolvedPath,
        data:
          Object.keys(bodyPayload).length > 0 ? bodyPayload : undefined,
      });

      const respData = response.data as Record<string, unknown> | undefined;
      if (
        respData &&
        typeof respData === 'object' &&
        (respData.status === 'error' || respData.success === false)
      ) {
        const msg = String(
          respData.pesan || respData.message || respData.error || 'Permintaan ditolak oleh server.'
        );
        setErrorMsg(msg);
        return;
      }

      setSuccessResult(response.data);
      onSuccess();
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isJabatanInUseError = Boolean(
    isDeleteJabatan &&
      errorMsg &&
      /pegawai|dipakai|digunakan|terpakai|masih|referensi|foreign key|conflict/i.test(
        errorMsg
      )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white text-slate-900 overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-action-title"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-500 tabular-nums truncate">
              {action.method} {previewRequest.path}
            </div>
            <h3 id="modal-action-title" className="text-base font-bold text-slate-900 mt-0.5">
              {action.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {action.description}
          </p>

          {isDeleteJabatan && jabatanUsagePreview && !successResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
              <div className="font-semibold text-slate-800">
                Target Jabatan: {jabatanUsagePreview.jabatanName}
                {jabatanUsagePreview.singkatan
                  ? ` (${jabatanUsagePreview.singkatan})`
                  : ''}
              </div>
              {jabatanUsagePreview.activeHolders.length > 0 ? (
                <p className="text-amber-800 leading-relaxed">
                  Perhatian: Jabatan ini terdeteksi masih dipakai oleh{' '}
                  <strong>{jabatanUsagePreview.activeHolders.length} pegawai aktif</strong>{' '}
                  (
                  {jabatanUsagePreview.activeHolders
                    .map((h) => `${h.nama} [${h.nip}]`)
                    .join(', ')}
                  ). Server akan menolak penghapusan selama jabatan masih terpakai.
                </p>
              ) : (
                <p className="text-slate-600">
                  Pastikan jabatan ini tidak sedang tercatat pada riwayat jabatan pegawai sebelum menghapus.
                </p>
              )}
            </div>
          )}

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              <div className="space-y-1">
                <AlertTitle>
                  {isJabatanInUseError
                    ? 'Gagal Menghapus — Jabatan Masih Dipakai Pegawai'
                    : 'Permintaan Gagal'}
                </AlertTitle>
                <AlertDescription className="space-y-1.5">
                  <p>{errorMsg}</p>
                  {isJabatanInUseError && (
                    <p className="text-xs text-red-800/90">
                      Silakan ubah atau alihkan penugasan jabatan pada pegawai yang bersangkutan terlebih dahulu sebelum menghapus master jabatan ini.
                    </p>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {successResult !== null && (
            <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-950">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-2">
                <AlertTitle>Berhasil Diproses</AlertTitle>
                <AlertDescription>
                  <pre className="mt-1 p-3 rounded-lg bg-white border border-emerald-200 font-mono text-xs text-slate-800 overflow-x-auto">
                    {JSON.stringify(successResult, null, 2)}
                  </pre>
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className="space-y-4 pt-1">
            {action.fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`field-${field.name}`}>
                    {field.label}
                    {field.required && <span className="text-red-600 ml-1">*</span>}
                  </Label>
                  {isPutJabatan && field.name === 'replid' && (
                    <button
                      type="button"
                      onClick={handleLoadJabatanById}
                      disabled={isSubmitting || isFetchingDetail}
                      className="text-xs font-semibold text-[#1565d8] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {isFetchingDetail ? 'Memuat...' : 'Muat Detail ID'}
                    </button>
                  )}
                </div>

                {field.type === 'select' && field.options ? (
                  <select
                    id={`field-${field.name}`}
                    value={values[field.name] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={`field-${field.name}`}
                    rows={3}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="flex w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                ) : (
                  <Input
                    id={`field-${field.name}`}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    disabled={isSubmitting}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Pratinjau Muatan JSON Real-Time */}
          {previewRequest.hasBody && (
            <div className="pt-2 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">
                Pratinjau Payload JSON
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto">
                {JSON.stringify(previewRequest.body, null, 2)}
              </pre>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Tutup
            </Button>
            <Button
              type="submit"
              variant={action.destructive ? 'destructive' : 'default'}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Kirim Permintaan</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
