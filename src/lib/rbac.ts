import type { ErpModuleDefinition } from '../data/erpModules';
import { RoleTingkat, type UserData } from '../types/auth';

export type PortalAccessMode =
  | 'landlord-bypass'
  | 'pegawai-hakakses'
  | 'siswa-selfservice'
  | 'calon-selfservice';

export interface StudentSelfServiceMenuItem {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  endpointHint: string;
}

/**
 * Menu khusus Tingkat 3 (Siswa) — hakakses kosong, otomatis terikat ke NIS (user.username)
 */
export const SISWA_MENU_ITEMS: StudentSelfServiceMenuItem[] = [
  {
    id: 'siswa-biodata',
    code: '01',
    label: 'Biodata & Profil Saya',
    shortLabel: 'Biodata Saya',
    description: 'Data induk kesiswaan, kelas aktif, dan informasi kontak wali murid.',
    endpointHint: 'GET /api/jbsakad/siswa/detail/:nis',
  },
  {
    id: 'siswa-jadwal',
    code: '02',
    label: 'Jadwal Pelajaran & Kalender',
    shortLabel: 'Jadwal Saya',
    description: 'Jadwal mata pelajaran kelas aktif Anda serta agenda kalender akademik sekolah.',
    endpointHint: 'GET /api/jbsakad/jadwal/kelas/:idkelas',
  },
  {
    id: 'siswa-nilai',
    code: '03',
    label: 'Rekapitulasi Nilai Ujian',
    shortLabel: 'Nilai Ujian',
    description: 'Daftar perolehan nilai ujian mata pelajaran berdasarkan NIS Anda.',
    endpointHint: 'GET /api/jbsakad/nilaiujian/:nis',
  },
  {
    id: 'siswa-presensi',
    code: '04',
    label: 'Presensi & Riwayat Kartu',
    shortLabel: 'Presensi Saya',
    description: 'Catatan kehadiran tatap muka pelajaran, presensi harian, dan riwayat kartu pintar.',
    endpointHint: 'GET /api/jbsakad/presensi-pelajaran/:nis',
  },
  {
    id: 'siswa-tagihan',
    code: '05',
    label: 'Rincian Tagihan Keuangan',
    shortLabel: 'Tagihan Saya',
    description: 'Daftar kewajiban biaya pendidikan, nominal terbayar, sisa tagihan, dan konfirmasi bayar.',
    endpointHint: 'GET /api/jbsfina/tagihan/:nis',
  },
  {
    id: 'siswa-pustaka',
    code: '06',
    label: 'Pinjaman, Katalog & E-Book Digital',
    shortLabel: 'Pustaka & E-Book',
    description: 'Status buku pinjaman aktif, pencarian katalog perpustakaan, serta akses baca e-book digital.',
    endpointHint: 'GET /api/jbsperpus/pinjam?nis=:nis',
  },
];

/**
 * Menu khusus Tingkat 4 (Calon Siswa PPDB) — hakakses kosong, otomatis terikat ke No. Pendaftaran (user.username)
 */
export const CALON_SISWA_MENU_ITEMS: StudentSelfServiceMenuItem[] = [
  {
    id: 'calon-tagihan',
    code: '01',
    label: 'Rincian Tagihan PPDB Saya',
    shortLabel: 'Tagihan PPDB',
    description: 'Daftar rincian biaya pendaftaran dan administrasi awal calon peserta didik baru.',
    endpointHint: 'GET /api/jbsfina/tagihan-calon/:nopes',
  },
  {
    id: 'calon-kalender',
    code: '02',
    label: 'Kalender Akademik Sekolah',
    shortLabel: 'Kalender Akademik',
    description: 'Informasi jadwal kegiatan tahun ajaran dan agenda resmi sekolah.',
    endpointHint: 'GET /api/jbsakad/kalender-akademik',
  },
  {
    id: 'calon-identitas',
    code: '03',
    label: 'Profil & Kontak Sekolah',
    shortLabel: 'Profil Sekolah',
    description: 'Informasi alamat resmi, telepon, email, dan unit departemen lembaga.',
    endpointHint: 'GET /api/jbsumum/identitas',
  },
];

export function isLandlordUser(user: UserData | null): boolean {
  if (!user) {
    return false;
  }
  return Number(user.tingkat) === RoleTingkat.LANDLORD;
}

export function resolvePortalMode(user: UserData | null): PortalAccessMode {
  if (isLandlordUser(user)) {
    return 'landlord-bypass';
  }
  const tingkat = Number(user?.tingkat ?? 0);
  if (tingkat === RoleTingkat.SISWA) {
    return 'siswa-selfservice';
  }
  if (tingkat === RoleTingkat.CALON_SISWA) {
    return 'calon-selfservice';
  }
  return 'pegawai-hakakses';
}

/**
 * Mengekstrak himpunan kode modul unik (uppercase) dari array user.hakakses
 */
export function extractUserModuleCodes(user: UserData | null): Set<string> {
  const codes = new Set<string>();
  if (!user || !Array.isArray(user.hakakses)) {
    return codes;
  }

  for (const entry of user.hakakses) {
    if (typeof entry === 'string') {
      const clean = entry.trim().toUpperCase();
      if (clean) codes.add(clean);
    } else if (entry && typeof entry === 'object') {
      const rawName = entry.modul ?? entry.nama;
      if (rawName) {
        const clean = String(rawName).trim().toUpperCase();
        if (clean) codes.add(clean);
      }
    }
  }

  return codes;
}

/**
 * Menentukan daftar modul ERP untuk Tingkat 1 (Landlord) & Tingkat 2 (Pegawai):
 * - Tingkat 1 (Landlord / Jibas): Bypass penuh ke seluruh modul ERP termasuk Manajemen Pengguna & Hak Akses (jbsuser).
 * - Tingkat 2 (Pegawai): Hanya menampilkan modul operasional yang diizinkan di user.hakakses; modul jbsuser selalu disembunyikan.
 */
export function resolvePermittedErpModules(
  user: UserData | null,
  allModules: ErpModuleDefinition[]
): ErpModuleDefinition[] {
  if (!user) {
    return [];
  }

  // 1. Tingkat 1 (Landlord / Jibas): Satu-satunya peran yang dapat melihat & mengelola jbsuser + seluruh modul lainnya
  if (isLandlordUser(user)) {
    return allModules.map((mod) => ({
      ...mod,
      matchedHakAkses: ['BYPASS SUPERADMIN'],
    }));
  }

  const tingkat = Number(user.tingkat);

  // 2. Tingkat 2 (Pegawai): Filter ketat berdasarkan user.hakakses & sembunyikan jbsuser sepenuhnya
  if (tingkat === RoleTingkat.PEGAWAI) {
    const pegawaiEligibleModules = allModules.filter(
      (mod) =>
        mod.id !== 'jbsuser' && mod.allowedTingkat.includes(RoleTingkat.PEGAWAI)
    );

    const ownedCodes = extractUserModuleCodes(user);
    if (ownedCodes.size === 0) {
      return [];
    }

    // Jika ada SUPERADMIN eksplisit pada hakakses pegawai, berikan modul operasional selain jbsuser
    if (ownedCodes.has('SUPERADMIN')) {
      return pegawaiEligibleModules.map((mod) => ({
        ...mod,
        matchedHakAkses: ['SUPERADMIN'],
      }));
    }

    const result: ErpModuleDefinition[] = [];

    for (const mod of pegawaiEligibleModules) {
      const matched = mod.hakAksesAliases.filter((alias) =>
        ownedCodes.has(alias.toUpperCase())
      );

      if (matched.length === 0) {
        continue;
      }

      let filteredMutations = mod.mutations;
      if (
        mod.id === 'jbsakad' &&
        !ownedCodes.has('SIMAKA') &&
        !ownedCodes.has('AKADEMIK') &&
        !ownedCodes.has('JBSAKAD')
      ) {
        filteredMutations = [];
      } else if (
        matched.length === 1 &&
        matched[0] === 'EMA'
      ) {
        filteredMutations = [];
      }

      result.push({
        ...mod,
        matchedHakAkses: matched,
        mutations: filteredMutations,
      });
    }

    return result;
  }

  // Tingkat 3 & 4 menggunakan menu khusus Siswa / Calon Siswa (bukan menu admin ERP)
  return [];
}
