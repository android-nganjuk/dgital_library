import { Globe, Mail, MapPin, Phone } from 'lucide-react';
import { AvatarImage } from './AvatarImage';

interface IdentityShowcaseProps {
  rows: Record<string, unknown>[];
  onInspectRow: (row: Record<string, unknown>) => void;
}

export function IdentityShowcase({ rows, onInspectRow }: IdentityShowcaseProps) {
  if (!rows.length) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Belum ada data profil identitas lembaga yang terdaftar.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {rows.map((item, idx) => {
        const nama = String(item.nama || 'Unit Sekolah');
        const departemen = item.departemen ? String(item.departemen) : 'Yayasan / Pusat';
        const alamatParts = [item.alamat1, item.alamat2, item.alamat3, item.alamat4]
          .filter((v) => Boolean(v && String(v).trim()))
          .map((v) => String(v).trim());
        const telpParts = [item.telp1, item.telp2, item.telp3, item.telp4]
          .filter((v) => Boolean(v && String(v).trim()))
          .map((v) => String(v).trim());
        const situs = item.situs ? String(item.situs).trim() : '';
        const email = item.email ? String(item.email).trim() : '';

        return (
          <div
            key={String(item.replid ?? idx)}
            className="p-6 sm:p-8 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-start gap-5 min-w-0">
              <AvatarImage
                rawSrc={item.foto}
                name={nama}
                kind="institution"
                size="lg"
              />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Departemen: {departemen}
                  </span>
                  {item.replid !== undefined && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">ID #{String(item.replid)}</span>
                    </>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {nama}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 pt-1 text-sm text-slate-600">
                  {alamatParts.length > 0 && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{alamatParts.join(', ')}</span>
                    </div>
                  )}

                  {telpParts.length > 0 && (
                    <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span>{telpParts.join(' / ')}</span>
                    </div>
                  )}

                  {email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{email}</span>
                    </div>
                  )}

                  {situs && (
                    <div className="flex items-center gap-2 text-xs">
                      <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{situs}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => onInspectRow(item)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Rincian Atribut
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
