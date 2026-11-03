import { useEffect, useState } from 'react';
import { QrCode, ShieldCheck, UserCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { extractResponsePayload, resolveImageSrc } from '../../lib/formatters';
import { RoleTingkat, type UserData } from '../../types/auth';
import { UserIdentityCard } from './UserIdentityCard';

interface JibasGreetingBannerProps {
  user: UserData;
  identitasRows?: Record<string, unknown>[];
  onOpenFileSharing: () => void;
  onOpenFullProfile?: () => void;
  onOpenHakAkses?: () => void;
}

function getJibasRoleSubtitle(
  user: UserData,
  liveJabatan?: string | null,
  liveBagian?: string | null
): string {
  const tingkat = Number(user.tingkat ?? 0);
  if (tingkat === RoleTingkat.LANDLORD) {
    return 'Administrator';
  }
  if (tingkat === RoleTingkat.PEGAWAI) {
    const jab = (liveJabatan || '').trim();
    const bag = (liveBagian || user.bagian || '').trim();
    if (jab && bag) return `${jab} · ${bag}`;
    if (jab) return jab;
    return bag ? `Pegawai · ${bag}` : 'Pegawai';
  }
  if (tingkat === RoleTingkat.SISWA) {
    return user.kelas ? `Siswa · Kelas ${user.kelas}` : 'Siswa';
  }
  if (tingkat === RoleTingkat.CALON_SISWA) {
    return 'Calon Siswa (PPDB)';
  }
  return `Tingkat ${tingkat}`;
}

export function JibasGreetingBanner({
  user,
  identitasRows,
  onOpenFileSharing,
  onOpenFullProfile,
  onOpenHakAkses,
}: JibasGreetingBannerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [showQrIdentityCard, setShowQrIdentityCard] = useState(false);
  const [livePegawaiMeta, setLivePegawaiMeta] = useState<{
    jabatan: string | null;
    bagian: string | null;
  }>({ jabatan: null, bagian: null });

  const resolvedPhoto = resolveImageSrc(user.foto);

  useEffect(() => {
    setImgFailed(false);
  }, [user.foto]);

  // Ambil atribut "jabatan" langsung dari GET /api/jbssdm/pegawai?nip=xxxxxxx saat login sebagai Pegawai
  useEffect(() => {
    const tingkat = Number(user.tingkat ?? 0);
    const nip = String(user.username ?? '').trim();
    if (tingkat !== RoleTingkat.PEGAWAI || !nip) {
      setLivePegawaiMeta({ jabatan: null, bagian: null });
      return;
    }

    let cancelled = false;
    apiClient
      .get('/jbssdm/pegawai', { params: { nip } })
      .then((res) => {
        if (cancelled) return;
        const parsed = extractResponsePayload(res.data);
        const row = parsed.rows[0] || parsed.singleObject;
        if (row) {
          setLivePegawaiMeta({
            jabatan: row.jabatan ? String(row.jabatan) : null,
            bagian: row.bagian ? String(row.bagian) : null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLivePegawaiMeta({ jabatan: null, bagian: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.tingkat, user.username]);

  const roleSubtitle = getJibasRoleSubtitle(
    user,
    livePegawaiMeta.jabatan,
    livePegawaiMeta.bagian
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        {/* Kiri: Avatar Lingkaran Berbingkai Putih + 4 Baris Greeting JIBAS */}
        <div className="flex items-center gap-5 sm:gap-6 min-w-0">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-white bg-white shadow-md ring-1 ring-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
            {resolvedPhoto && !imgFailed ? (
              <img
                src={resolvedPhoto}
                alt={`Foto ${user.nama}`}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <svg
                viewBox="0 0 120 120"
                className="h-full w-full block"
                role="img"
                aria-label={`Avatar ${user.nama}`}
              >
                <rect width="120" height="120" fill="#ffffff" />
                <circle cx="60" cy="43" r="23" fill="#17b2d3" />
                <path
                  d="M18 114c4-24 22-37 42-37s38 13 42 37H18z"
                  fill="#17b2d3"
                />
              </svg>
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <p className="text-xs sm:text-sm text-slate-600">Selamat Datang</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight [text-wrap:balance] break-words">
              {user.nama}
            </h1>
            <p className="text-sm sm:text-base text-slate-700 font-mono tabular-nums truncate">
              {user.username}
            </p>
            <p className="text-xs sm:text-sm text-slate-500">{roleSubtitle}</p>

            {/* Aksi Kontekstual Ringkas: Kartu QR & Profil */}
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => setShowQrIdentityCard((prev) => !prev)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5 text-[#1565d8]" aria-hidden="true" />
                <span>
                  {showQrIdentityCard
                    ? 'Sembunyikan Kartu QR'
                    : 'Kartu Identitas QR'}
                </span>
              </button>

              {onOpenFullProfile && (
                <button
                  type="button"
                  onClick={onOpenFullProfile}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserCircle2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Biodata Saya</span>
                </button>
              )}

              {onOpenHakAkses && (
                <button
                  type="button"
                  onClick={onOpenHakAkses}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Kelola Hak Akses</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kanan: Tombol Biru File Sharing Sesuai Referensi JIBAS */}
        <div className="flex items-center self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={onOpenFileSharing}
            className="px-7 py-3 rounded-lg bg-[#1565d8] hover:bg-[#1053b5] active:bg-[#0d479d] text-white text-sm font-medium shadow-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565d8] focus-visible:ring-offset-2"
          >
            File Sharing
          </button>
        </div>
      </div>

      {/* Panel Kartu Identitas QR (Dapat Dibuka / Ditutup dari Greeting) */}
      {showQrIdentityCard && (
        <div className="pt-2 max-w-2xl">
          <UserIdentityCard
            user={user}
            identitasRows={identitasRows}
            onOpenFullProfile={onOpenFullProfile}
          />
        </div>
      )}
    </div>
  );
}
