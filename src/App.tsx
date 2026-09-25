import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { RequireAdmin } from './components/layout/RequireAdmin';
import { LoadingMessage } from './components/ui/StateMessage';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth } from './components/layout/RequireAuth';
import { MissionRoute } from './components/mission/MissionRoute';
import { AchievementsPage } from './pages/AchievementsPage';
import { AuthPage } from './pages/AuthPage';
import { ChallengesPage } from './pages/ChallengesPage';
import { CreateProfilePage } from './pages/CreateProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { LearnPage } from './pages/LearnPage';
import { CategoryPage } from './pages/learning/CategoryPage';
import { LessonPage as LearningLessonPage } from './pages/learning/LessonPage';
import { LessonQuizPage } from './pages/learning/LessonQuizPage';
import { LibraryPage } from './pages/learning/LibraryPage';
import { ChallengePage } from './pages/mission/ChallengePage';
import { LessonPage } from './pages/mission/LessonPage';
import { ChecklistPage } from './pages/mission/ChecklistPage';
import { QuizPage } from './pages/mission/QuizPage';
import { RewardPage } from './pages/mission/RewardPage';
import { TrackingPage } from './pages/mission/TrackingPage';
import { PlayersPage } from './pages/PlayersPage';
import { ProfilePage } from './pages/ProfilePage';
import { WelcomePage } from './pages/WelcomePage';
import { WorldPage } from './pages/WorldPage';
import { AuthProvider } from './state/AuthContext';
import { GameProvider } from './state/GameContext';

// Telas menos usadas são carregadas sob demanda (o app abre mais rápido).
const PerformancePage = lazy(() => import('./pages/PerformancePage').then((m) => ({ default: m.PerformancePage })));
const EvolutionPage = lazy(() => import('./pages/EvolutionPage').then((m) => ({ default: m.EvolutionPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const AboutPage = lazy(() => import('./pages/public/AboutPage').then((m) => ({ default: m.AboutPage })));
const TermsPage = lazy(() => import('./pages/public/TermsPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const RecoverPasswordPage = lazy(() => import('./pages/public/PasswordPages').then((m) => ({ default: m.RecoverPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/public/PasswordPages').then((m) => ({ default: m.ResetPasswordPage })));
// Módulo Meu Lugar (casa 3D): carregado só quando aberto (o three.js fica fora do app principal).
const PlacePage = lazy(() => import('./modules/place/PlacePage').then((m) => ({ default: m.PlacePage })));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <GameProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="screen-center"><LoadingMessage /></div>}>
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/entrar" element={<AuthPage />} />
          <Route path="/login" element={<Navigate to="/entrar" replace />} />
          <Route path="/cadastro" element={<Navigate to="/entrar?modo=cadastro" replace />} />
          <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/sobre" element={<AboutPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          {/* Demonstração: vários jogadores no mesmo aparelho */}
          <Route path="/jogadores" element={<PlayersPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/criar-perfil" element={<CreateProfilePage />} />
            <Route element={<AppShell />}>
              <Route path="/inicio" element={<DashboardPage />} />
              <Route path="/mundo" element={<WorldPage />} />
              <Route path="/desafios" element={<ChallengesPage />} />
              {/* Sistema de aprendizagem */}
              <Route path="/aprender" element={<LearnPage />} />
              <Route path="/aprender/biblioteca" element={<LibraryPage />} />
              <Route path="/aprender/:categorySlug" element={<CategoryPage />} />
              <Route path="/aula/:lessonSlug" element={<LearningLessonPage />} />
              <Route path="/aula/:lessonSlug/quiz" element={<LessonQuizPage />} />
              <Route path="/conquistas" element={<AchievementsPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/perfil/desempenho" element={<PerformancePage />} />
              <Route path="/perfil/evolucao" element={<EvolutionPage />} />
              {/* Nomes alternativos */}
              <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
              <Route path="/meu-mundo" element={<Navigate to="/mundo" replace />} />
              <Route path="/meu-lugar" element={<PlacePage />} />
              {/* A prévia 3D virou o próprio mundo */}
              <Route path="/mundo/previa-3d" element={<Navigate to="/mundo" replace />} />
              {/* Administração: a tela confere o papel; o servidor confere de novo em cada chamada */}
              <Route path="/admin" element={<RequireAdmin />}>
                <Route index element={<AdminPage />} />
              </Route>

              {/* Ciclo da missão: APRENDER → QUIZ → DESAFIO → EXECUTAR (checklist) → ACOMPANHAR → RECOMPENSA */}
              <Route path="/missao/:challengeSlug">
                <Route index element={<Navigate to="aprender" replace />} />
                <Route path="aprender" element={<MissionRoute step="aprender"><LessonPage /></MissionRoute>} />
                <Route path="quiz" element={<MissionRoute step="quiz"><QuizPage /></MissionRoute>} />
                <Route path="desafio" element={<MissionRoute step="desafio"><ChallengePage /></MissionRoute>} />
                <Route path="comprovar" element={<MissionRoute step="comprovar"><ChecklistPage /></MissionRoute>} />
                <Route path="acompanhar" element={<MissionRoute step="acompanhar"><TrackingPage /></MissionRoute>} />
                <Route path="recompensa" element={<MissionRoute step="recompensa"><RewardPage /></MissionRoute>} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </GameProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
