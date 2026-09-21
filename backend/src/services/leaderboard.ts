type Participant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  fantasyTeam: { players: { player: { position: string } }[] } | null;
  gameweekPoints: { totalPoints: number; gameweek: { number: number } }[];
};

export function overallStandings(users: Participant[], completedWeeks: number[]) {
  const [currentWeek, previousWeek] = [...completedWeeks].sort((a, b) => b - a);
  const totalsAt = (week: number) => users
    .filter(user => user.gameweekPoints.some(row => row.gameweek.number <= week))
    .map(user => ({ id: user.id, totalPoints: user.gameweekPoints.filter(row => row.gameweek.number <= week).reduce((sum, row) => sum + row.totalPoints, 0) }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.id.localeCompare(b.id));
  // Compare cumulative standings at two global round boundaries, never each
  // user's last two scores (users can miss rounds or join at different times).
  const currentRanks = new Map(currentWeek === undefined ? [] : totalsAt(currentWeek).map((row, index) => [row.id, index + 1]));
  const previousRanks = new Map(previousWeek === undefined ? [] : totalsAt(previousWeek).map((row, index) => [row.id, index + 1]));
  return users.filter(user => user.gameweekPoints.length > 0 || (user.fantasyTeam?.players.length === 10 && user.fantasyTeam.players.filter(entry => entry.player.position === "GOALKEEPER").length === 2))
    .map(user => {
      const previous = previousRanks.get(user.id);
      const current = currentRanks.get(user.id);
      return {
        id: user.id, name: user.name, avatarUrl: user.avatarUrl,
        totalPoints: user.gameweekPoints.reduce((sum, row) => sum + row.totalPoints, 0),
        lastGameweekPoints: user.gameweekPoints.find(row => row.gameweek.number === currentWeek)?.totalPoints ?? 0,
        rankChange: previous !== undefined && current !== undefined ? previous - current : null,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.id.localeCompare(b.id))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
