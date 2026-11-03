import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Menu,
  Smartphone,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { ERP_MODULES, type ErpMutationAction } from '../data/erpModules';
import { useSchoolIdentity } from '../hooks/useSchoolIdentity';
import {
  CALON_SISWA_MENU_ITEMS,
  SISWA_MENU_ITEMS,
  isLandlordUser,
  resolvePermittedErpModules,
  resolvePortalMode,
} from '../lib/rbac';
import { Button } from '../components/ui/button';
import { ExecutiveOverview } from '../components/erp/ExecutiveOverview';
import { MobileViewWorkspace } from '../components/erp/MobileViewWorkspace';
import { ModuleWorkspace } from '../components/erp/ModuleWorkspace';
import { StudentPortalWorkspace } from '../components/erp/StudentPortalWorkspace';
import { EntityDetailSheet } from '../components/erp/EntityDetailSheet';
import { EndpointFormModal } from '../components/erp/EndpointFormModal';
import { DigitalBookReaderModal } from '../components/erp/DigitalBookReaderModal';
import { AvatarImage } from '../components/erp/AvatarImage';
import { RoleTingkat } from '../types/auth';
import type { InspectedEntity } from '../components/erp/SmartDataTable';

interface DashboardLocationState {
  pendingDigitalBook?: Record<string, unknown>;
}

const COMPACT_MODULE_LABELS: Record<string, string> = {
  jbsakad: 'Akademik',
  jcbe: 'Ujian CBE',
  jbsfina: 'Keuangan',
  jbssdm: 'Kepegawaian',
  jbsumum: 'Umum',
  jbsperpus: 'Perpustakaan',
  jbsuser: 'Hak Akses',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { primary: school } = useSchoolIdentity();

  const [activeSection, setActiveSection] = useState<string>('overview');
  const [initialModuleViewId, setInitialModuleViewId] = useState<
    string | undefined
  >(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inspectedEntity, setInspectedEntity] = useState<InspectedEntity | null>(
    null
  );
  const [activeMutation, setActiveMutation] = useState<{
    action: ErpMutationAction;
    initialValues?: Record<string, string>;
  } | null>(null);
  const [autoReadBook, setAutoReadBook] = useState<Record<string, unknown> | null>(
    null
  );
  const [refreshSignal, setRefreshSignal] = useState(0);

  const isLandlord = useMemo(() => isLandlordUser(user), [user]);
  const portalMode = useMemo(() => resolvePortalMode(user), [user]);
  const isStudentOrApplicant =
    portalMode === 'siswa-selfservice' || portalMode === 'calon-selfservice';

  // Tingkat 1 (Landlord): Bypass semua modul | Tingkat 2 (Pegawai): Hanya modul operasional di dalam user.hakakses (tanpa jbsuser)
  const accessibleModules = useMemo(
    () => resolvePermittedErpModules(user, ERP_MODULES),
    [user]
  );

  // Tingkat 3 (Siswa) & Tingkat 4 (Calon Siswa): Menu mandiri khusus siswa/calon
  const studentMenuItems = useMemo(() => {
    if (portalMode === 'siswa-selfservice') return SISWA_MENU_ITEMS;
    if (portalMode === 'calon-selfservice') return CALON_SISWA_MENU_ITEMS;
    return [];
  }, [portalMode]);

  // Pastikan activeSection selalu valid ketika akun / hakakses berganti dan jbsuser hanya untuk Landlord
  useEffect(() => {
    if (activeSection === 'jbsuser' && !isLandlord) {
      setActiveSection('overview');
      return;
    }

    if (activeSection === 'overview' || activeSection === 'mobile-view') return;

    if (isStudentOrApplicant) {
      const valid = studentMenuItems.some((item) => item.id === activeSection);
      if (!valid) setActiveSection('overview');
    } else {
      const valid = accessibleModules.some((mod) => mod.id === activeSection);
      if (!valid) setActiveSection('overview');
    }
  }, [
    activeSection,
    isLandlord,
    isStudentOrApplicant,
    studentMenuItems,
    accessibleModules,
  ]);

  // Buka otomatis pembaca buku digital apabila pengguna baru saja login dari pratinjau buku di Landing Page
  useEffect(() => {
    const locState = location.state as DashboardLocationState | null;
    if (!locState?.pendingDigitalBook || !user) {
      return;
    }

    setAutoReadBook(locState.pendingDigitalBook);

    if (Number(user.tingkat) === RoleTingkat.SISWA) {
      setActiveSection('siswa-pustaka');
    } else if (accessibleModules.some((mod) => mod.id === 'jbsperpus')) {
      setActiveSection('jbsperpus');
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, user, accessibleModules]);

  const selectedModule = useMemo(
    () =>
      !isStudentOrApplicant && activeSection !== 'mobile-view'
        ? accessibleModules.find((mod) => mod.id === activeSection) ?? null
        : null,
    [isStudentOrApplicant, accessibleModules, activeSection]
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSelectSection = (sectionId: string, viewId?: string) => {
    setActiveSection(sectionId);
    setInitialModuleViewId(viewId);
    setMobileMenuOpen(false);
  };

  if (!user) {
    return null;
  }

  const firstPrimaryServiceId = isStudentOrApplicant
    ? studentMenuItems[0]?.id ?? 'overview'
    : accessibleModules[0]?.id ?? 'overview';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header Utama Horizontal (Pengganti Sidebar Kiri di Laptop/Desktop) */}
      <header className="h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
        <div className="max-w-[1400px] w-full h-full mx-auto flex items-center justify-between gap-4 xl:gap-8">
          {/* Zona 1: Tombol Menu Ponsel + Identitas Sekolah (1 Baris) */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden min-h-[42px] min-w-[42px] -ml-2 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 shrink-0 cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectSection('overview')}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer"
            >
              {school.logoSrc ? (
                <img
                  src={school.logoSrc}
                  alt={school.nama}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white p-0.5 object-contain shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
              <span className="text-sm font-bold tracking-tight text-slate-900 max-w-[170px] sm:max-w-[220px] xl:max-w-[240px] truncate whitespace-nowrap">
                {school.nama}
              </span>
            </button>
          </div>

          {/* Zona 2: Navigasi Horizontal di Header (Khusus Laptop & Desktop >= lg) */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden lg:flex items-center h-full gap-1 xl:gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0"
          >
            <button
              type="button"
              onClick={() => handleSelectSection('overview')}
              title="Beranda Greeting"
              className={`h-full px-2.5 xl:px-3 inline-flex items-center gap-1.5 border-b-2 text-xs xl:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'overview'
                  ? 'border-[#1565d8] text-slate-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-950 hover:border-slate-300 font-medium'
              }`}
            >
              <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Beranda</span>
            </button>

            {isStudentOrApplicant
              ? studentMenuItems.map((item) => {
                  const isSelected = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSection(item.id)}
                      className={`h-full px-2.5 xl:px-3 inline-flex items-center border-b-2 text-xs xl:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'border-[#1565d8] text-slate-950 font-semibold'
                          : 'border-transparent text-slate-600 hover:text-slate-950 hover:border-slate-300 font-medium'
                      }`}
                    >
                      {item.shortLabel}
                    </button>
                  );
                })
              : accessibleModules.map((mod) => {
                  const isSelected = activeSection === mod.id;
                  const navLabel = COMPACT_MODULE_LABELS[mod.id] || mod.shortName;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleSelectSection(mod.id)}
                      className={`h-full px-2.5 xl:px-3 inline-flex items-center border-b-2 text-xs xl:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'border-[#1565d8] text-slate-950 font-semibold'
                          : 'border-transparent text-slate-600 hover:text-slate-950 hover:border-slate-300 font-medium'
                      }`}
                    >
                      {navLabel}
                    </button>
                  );
                })}

            <button
              type="button"
              onClick={() => handleSelectSection('mobile-view')}
              title="Tampilan Mobile App"
              className={`h-full px-2.5 xl:px-3 inline-flex items-center gap-1.5 border-b-2 text-xs xl:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'mobile-view'
                  ? 'border-[#1565d8] text-slate-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-950 hover:border-slate-300 font-medium'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Mobile View</span>
            </button>
          </nav>

          {/* Zona 3: Identitas Akun & Tombol Keluar (Bergaya JIBAS Kanan Atas) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectSection('overview')}
              className="hidden sm:flex items-center gap-2.5 text-right rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Kembali ke Beranda Profil"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-slate-500 tabular-nums leading-tight truncate max-w-[150px]">
                  {user.username}
                </div>
                <div className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[150px] xl:max-w-[190px]">
                  {user.nama}
                </div>
              </div>
              <AvatarImage
                rawSrc={user.foto}
                name={user.nama}
                size="sm"
                className="hidden xl:flex h-8 w-8 rounded-full"
              />
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4 text-rose-600" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Drawer Menu Khusus Layar Ponsel / Tablet Kecil (< lg) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <aside className="relative z-10 w-72 max-w-[84vw] bg-white h-full border-r border-slate-200 flex flex-col justify-between shadow-xl">
            <div className="overflow-y-auto">
              <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 truncate">
                  Menu Navigasi
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Tutup menu navigasi"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <nav className="p-3 space-y-1" aria-label="Menu Ponsel">
                <button
                  type="button"
                  onClick={() => handleSelectSection('overview')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeSection === 'overview'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Beranda</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSection('mobile-view')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeSection === 'mobile-view'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Mobile View</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      activeSection === 'mobile-view'
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    App
                  </span>
                </button>

                <div className="pt-3 pb-1 px-3 text-xs font-medium text-slate-400">
                  {portalMode === 'landlord-bypass' && 'Semua Modul Sistem'}
                  {portalMode === 'pegawai-hakakses' && 'Modul Sesuai Hak Akses'}
                  {portalMode === 'siswa-selfservice' && 'Layanan Siswa'}
                  {portalMode === 'calon-selfservice' && 'Layanan Calon Siswa'}
                </div>

                {isStudentOrApplicant ? (
                  studentMenuItems.map((item) => {
                    const isSelected = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSection(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span
                          className={`font-mono text-xs tabular-nums shrink-0 ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {item.code}.
                        </span>
                        <span className="truncate">{item.shortLabel}</span>
                      </button>
                    );
                  })
                ) : accessibleModules.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    Tidak ada modul pada daftar hakakses akun Anda.
                  </div>
                ) : (
                  accessibleModules.map((mod) => {
                    const isSelected = activeSection === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleSelectSection(mod.id)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono text-xs tabular-nums shrink-0 ${
                              isSelected ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {mod.code}.
                          </span>
                          <span className="truncate">{mod.shortName}</span>
                        </div>
                        <span
                          className={`font-mono text-[11px] tabular-nums shrink-0 ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {mod.views.length}
                        </span>
                      </button>
                    );
                  })
                )}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center gap-3">
              <AvatarImage
                rawSrc={user.foto}
                name={user.nama}
                size="sm"
                className="h-9 w-9 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {user.nama}
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums truncate">
                  {user.username} · Tingkat {user.tingkat}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Konten Utama Lebar Penuh yang Nyaman di Layar Laptop */}
      <main
        className={`flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 ${
          activeSection === 'mobile-view' ? 'pb-8' : 'pb-24 lg:pb-10'
        }`}
      >
        {activeSection === 'mobile-view' ? (
          <MobileViewWorkspace
            user={user}
            onInspectEntity={(ent) => setInspectedEntity(ent)}
            onTriggerMutation={(action, initialValues) =>
              setActiveMutation({ action, initialValues })
            }
            onOpenDesktopModule={handleSelectSection}
            refreshSignal={refreshSignal}
          />
        ) : isStudentOrApplicant ? (
          <StudentPortalWorkspace
            user={user}
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
            onInspectEntity={(ent) => setInspectedEntity(ent)}
            onTriggerMutation={(action, initialValues) =>
              setActiveMutation({ action, initialValues })
            }
            refreshSignal={refreshSignal}
          />
        ) : selectedModule ? (
          <ModuleWorkspace
            module={selectedModule}
            initialViewId={initialModuleViewId}
            isLandlord={isLandlord}
            onInspectEntity={(ent) => setInspectedEntity(ent)}
            onTriggerMutation={(action, initialValues) =>
              setActiveMutation({ action, initialValues })
            }
            onMutated={() => setRefreshSignal((n) => n + 1)}
            refreshSignal={refreshSignal}
          />
        ) : (
          <ExecutiveOverview
            user={user}
            accessibleModules={accessibleModules}
            onSelectModule={handleSelectSection}
            onInspectEntity={(ent) => setInspectedEntity(ent)}
            onTriggerMutation={(action, initialValues) =>
              setActiveMutation({ action, initialValues })
            }
            refreshSignal={refreshSignal}
          />
        )}
      </main>

      {/* Navigasi Bawah Khusus Layar Ponsel (Tetap Dipertahankan di Mobile) */}
      {activeSection !== 'mobile-view' && (
        <nav
          aria-label="Navigasi Cepat Ponsel"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center"
        >
          <button
            type="button"
            onClick={() => handleSelectSection('overview')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer ${
              activeSection === 'overview'
                ? 'text-slate-900 font-semibold'
                : 'text-slate-400 hover:text-slate-700 font-medium'
            }`}
          >
            <Home className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] tracking-tight">Beranda</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection(firstPrimaryServiceId)}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer ${
              activeSection !== 'overview' && activeSection !== 'mobile-view'
                ? 'text-slate-900 font-semibold'
                : 'text-slate-400 hover:text-slate-700 font-medium'
            }`}
          >
            <Layers className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] tracking-tight">Layanan</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('mobile-view')}
            className="min-h-[48px] flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
          >
            <Smartphone className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] tracking-tight">Mobile View</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="min-h-[48px] flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] tracking-tight">Semua Menu</span>
          </button>
        </nav>
      )}

      {/* Panel Slide-Over Detail Rekaman / Profil Lintas Modul / JSON */}
      <EntityDetailSheet
        entity={inspectedEntity}
        canManageHakAkses={isLandlord}
        onClose={() => setInspectedEntity(null)}
        onMutated={() => setRefreshSignal((n) => n + 1)}
      />

      {/* Modal Eksekusi Form POST / PUT / DELETE */}
      <EndpointFormModal
        action={activeMutation?.action ?? null}
        initialValues={activeMutation?.initialValues}
        onClose={() => setActiveMutation(null)}
        onSuccess={() => setRefreshSignal((n) => n + 1)}
      />

      {/* Modal Pembaca Buku Digital Otomatis Pasca-Login dari Landing Page */}
      <DigitalBookReaderModal
        book={autoReadBook}
        studentNis={
          Number(user.tingkat) === RoleTingkat.SISWA
            ? String(user.username || '').trim()
            : undefined
        }
        onClose={() => setAutoReadBook(null)}
        onReadLogged={() => setRefreshSignal((n) => n + 1)}
      />
    </div>
  );
}
