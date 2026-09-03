type NumberedPlayer = {
  id: string;
  clubId: string;
  number: number;
};

export function withDisplayNumbers<T extends NumberedPlayer>(players: T[]) {
  const occurrences = new Map<string, number>();

  return players.map((player) => {
    const key = `${player.clubId}:${player.number}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);

    return {
      ...player,
      // The roster keeps its official number; repeated numbers gain one leading zero.
      displayNumber: occurrence === 0 ? String(player.number) : `0${player.number}`,
    };
  });
}
