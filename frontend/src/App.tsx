import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useLocale } from "./contexts/LocaleContext";
import { AppShell } from "./layouts/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { ClubPage } from "./pages/ClubPage";
import { CalendarPage } from "./pages/CalendarPage";
import { HomePage } from "./pages/HomePage";
import { LeaguePage } from "./pages/LeaguePage";
import { MemberTeamPage } from "./pages/MemberTeamPage";
import { MyTeamPage } from "./pages/MyTeamPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PurchasePlayersPage } from "./pages/PurchasePlayersPage";
import { TeamsPage } from "./pages/TeamsPage";
import { AdminPlayerPricesPage } from "./pages/AdminPlayerPricesPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminPlayerPointsPage } from "./pages/AdminPlayerPointsPage";
import { Loader } from "./components/Loader";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { RulesPage } from "./pages/RulesPage";
import { PrivateLeaguePage } from "./pages/PrivateLeaguePage";
import { FriendLeaguesPage } from "./pages/FriendLeaguesPage";

function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  if (isLoading)
    return (
      <main className="initial-loader">
        <Loader label={t("loading.app")} />
      </main>
    );
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <AppShell />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin/player-prices" element={<AdminPlayerPricesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/users" element={<AdminPage />} />
        <Route
          path="/admin/player-points"
          element={<AdminPlayerPointsPage />}
        />
        <Route path="/my-team" element={<MyTeamPage />} />
        <Route path="/purchase-players" element={<PurchasePlayersPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:clubId" element={<ClubPage />} />
        <Route path="/league" element={<LeaguePage />} />
        <Route path="/friend-leagues" element={<FriendLeaguesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/league/:id" element={<PrivateLeaguePage />} />
        <Route path="/league/member/:userId" element={<MemberTeamPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
