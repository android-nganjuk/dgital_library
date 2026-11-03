import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ERP_MODULES, type ErpMutationAction } from '../../data/erpModules';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatDateId,
  formatNumberId,
} from '../../lib/formatters';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DigitalBookReaderModal } from './DigitalBookReaderModal';
import type { InspectedEntity } from './SmartDataTable';

interface FileSharingModalProps {
  open: boolean;
  onClose: () => void;
  canAccessUmum?: boolean;
  canManageDigitalFiles?: boolean;
  studentNis?: string;
  onTriggerMutation?: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  onInspectEntity?: (entity: InspectedEntity) => void;
  refreshSignal?: number;
}

type FileCategoryFilter = 'all' | 'ebook' | 'dokumen';

interface SharedFileItem {
  key: string;
  category: 'ebook' | 'dokumen';
  title: string;
  subtitle: string;
  formatLabel: string;
  dateLabel: string;
  url: string;
  rawRow: Record<string, unknown>;
}

export function FileSharingModal({
  open,
  onClose,
  canAccessUmum = false,
  canManageDigitalFiles = false,
  studentNis,
  onTriggerMutation,
  onInspectEntity,
  refreshSignal = 0,
}: FileSharingModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<SharedFileItem[]>([]);
  const [category, setCategory] = useState<FileCategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<Record<string, unknown> | null>(
    null
  );

  const loadSharedFiles = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const [digitalRes, suratRes] = await Promise.allSettled([
        apiClient.get('/jbsperpus/pustaka/digital'),
        canAccessUmum
          ? apiClient.get('/jbsumum/pengantarsurat')
          : Promise.resolve(null),
      ]);

      const collected: SharedFileItem[] = [];

      if (digitalRes.status === 'fulfilled' && digitalRes.value) {
        const parsed = extractResponsePayload(digitalRes.value.data);
        parsed.rows.forEach((row, index) => {
          const id = String(row.id ?? row.idpustaka ?? index + 1);
          const idPustaka = row.idpustaka ? `ID Pustaka #${row.idpustaka}` : 'Pustaka Digital';
          const tipe = String(row.tipe || 'PDF').toUpperCase();
          const url = String(row.file_url || row.url || row.link || '').trim();
          collected.push({
            key: `ebook-${id}`,
            category: 'ebook',
            title: String(row.judul || `Buku Digital #${id}`),
            subtitle: `${idPustaka} · Koleksi Perpustakaan`,
            formatLabel: tipe,
            dateLabel: row.tanggal ? formatDateId(row.tanggal) : 'Tersedia',
            url,
            rawRow: row,
          });
        });
      }

      if (suratRes.status === 'fulfilled' && suratRes.value) {
        const parsed = extractResponsePayload(suratRes.value.data);
        parsed.rows.forEach((row, index) => {
          const id = String(row.replid ?? row.id ?? index + 1);
          const dept = String(row.departemen || 'Umum');
          collected.push({
            key: `surat-${id}`,
            category: 'dokumen',
            title: String(row.judul || `Dokumen Pengantar #${id}`),
            subtitle: `Departemen ${dept} · Arsip Pengantar Surat`,
            formatLabel: 'DOKUMEN',
            dateLabel: row.tanggal ? formatDateId(row.tanggal) : '-',
            url: '',
            rawRow: row,
          });
        });
      }

      setItems(collected);
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err, '/api/jbsperpus/pustaka/digital'));
    } finally {
      setLoading(false);
    }
  }, [open, canAccessUmum]);

  useEffect(() => {
    if (open) {
      loadSharedFiles();
    }
  }, [open, loadSharedFiles, refreshSignal]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.formatLabel.toLowerCase().includes(q)
      );
    });
  }, [items, category, query]);

  const handleCopyUrl = async (key: string, url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      // Abaikan apabila clipboard diblokir browser
    }
  };

  const handleTriggerUploadDigital = () => {
    if (!onTriggerMutation) return;
    const perpusMod = ERP_MODULES.find((m) => m.id === 'jbsperpus');
    const tautkanAction = perpusMod?.mutations.find(
      (m) => m.id === 'tautkan-pustaka-digital'
    );
    if (tautkanAction) {
      onClose();
      onTriggerMutation(tautkanAction);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-sharing-modal-title"
      >
        <div
          className="w-full max-w-4xl max-h-[88vh] rounded-2xl bg-white border border-slate-200 shadow-xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Modal */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-[#1565d8] text-white flex items-center justify-center shrink-0">
                <FolderOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2
                  id="file-sharing-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 truncate"
                >
                  File Sharing & Pustaka Digital Sekolah
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  Repositori terpadu berkas e-book pembelajaran dan dokumen resmi sekolah
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canManageDigitalFiles && onTriggerMutation && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleTriggerUploadDigital}
                  className="bg-[#1565d8] hover:bg-[#1053b5] text-white"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Bagikan File Baru</span>
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup jendela File Sharing"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Toolbar Filter & Pencarian */}
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  category === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({formatNumberId(items.length)})
              </button>
              <button
                type="button"
                onClick={() => setCategory('ebook')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  category === 'ebook'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                E-Book Digital
              </button>
              {canAccessUmum && (
                <button
                  type="button"
                  onClick={() => setCategory('dokumen')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    category === 'dokumen'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dokumen Umum
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search
                  className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari judul berkas atau buku..."
                  className="pl-9 h-9 bg-white text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadSharedFiles}
                disabled={loading}
                className="h-9 px-3 shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="sr-only sm:not-sr-only">Muat Ulang</span>
              </Button>
            </div>
          </div>

          {/* Daftar Berkas */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {errorMsg && (
              <div className="p-6 text-sm text-rose-700 bg-rose-50/70">
                {errorMsg}
              </div>
            )}

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="h-14 rounded-lg bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  Belum ada berkas yang cocok
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tidak ditemukan berkas digital untuk kata kunci atau kategori yang dipilih.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.key}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {item.category === 'ebook' ? (
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 break-words">
                        {item.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-700">
                          {item.formatLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.subtitle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.dateLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyUrl(item.key, item.url)}
                        className="h-8 px-2.5 text-xs"
                      >
                        {copiedKey === item.key ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Salin Link</span>
                          </>
                        )}
                      </Button>
                    )}

                    {item.category === 'ebook' ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setReadingBook(item.rawRow)}
                        className="h-8 px-3 text-xs"
                      >
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Buka Berkas</span>
                      </Button>
                    ) : (
                      onInspectEntity && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            onClose();
                            onInspectEntity({
                              mode: 'generic',
                              title: item.title,
                              row: item.rawRow,
                            });
                          }}
                          className="h-8 px-3 text-xs"
                        >
                          <span>Lihat Dokumen</span>
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Ringkas */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="tabular-nums">
              Menampilkan {formatNumberId(filteredItems.length)} dari{' '}
              {formatNumberId(items.length)} berkas bersama
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Pembaca E-Book Langsung */}
      <DigitalBookReaderModal
        book={readingBook}
        studentNis={studentNis}
        onClose={() => setReadingBook(null)}
      />
    </>
  );
}
