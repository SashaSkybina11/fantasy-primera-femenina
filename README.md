# Fantasy Primera División Fútbol Sala Femenino

An interactive fantasy game dedicated to Spanish women's futsal. The project is built around the **Primera División Fútbol Sala Femenino**, allowing users to create their own teams from real players, explore clubs, follow the competition, and compete with other members of the fantasy league.

## About the Project

Fantasy Primera División Fútbol Sala Femenino aims to make women's futsal more visible, accessible, and engaging for fans. More than a collection of player statistics, the platform offers a personal way to experience the league: choose a favorite club, discover the teams competing in the championship, build a fantasy squad, and compare it with those created by other users.

The project combines sports statistics, strategic team management, and the community spirit of a friendly fantasy league. It is designed for both dedicated futsal fans and people discovering the sport for the first time.

## Features

- **Fantasy team management** with a fixed budget.
- **Real players and clubs** from the Spanish Primera División Fútbol Sala Femenino.
- **Squad building:** sign players, choose a starting lineup and substitutes, and appoint a captain.
- **Club pages** with squad lists and key information.
- **Fantasy league** where users can explore and compare other teams.
- **Favorite club rankings** based on user votes.
- **Official competition calendar** based on RFEF data.
- **Top scorers and club goal statistics**, combining baseline data through Matchday 3 with player statistics from subsequent matchdays.
- **Multilingual interface** in Spanish, Ukrainian, and English.
- **Light and dark themes**, with a responsive layout for desktop, tablet, and mobile devices.

## How to Play

1. Create a profile and give your fantasy team a name.
2. Choose the club you want to support throughout the season.
3. Build your squad by selecting your favorite players or those you consider the strongest options.
4. Set your starting lineup, substitutes, and captain.
5. Follow the league, compare teams, and track the real competition as the season progresses.

## Who Is It For?

The platform is designed for women's futsal fans, fantasy sports enthusiasts, players, and anyone interested in discovering the Spanish Primera División Fútbol Sala Femenino through an interactive and personal experience.

## Results and Top Scorers

The file `backend/src/data/scorers.ts` contains the administrator-provided top-scorer dataset through Matchday 3, covering **87 players and 133 goals**.

Shortened player names in club squads are matched to the dataset by club using `scorer-aliases.ts`.

These baseline data are used for display purposes only and do not affect player prices, budgets, or fantasy points. Starting from Matchday 4, the top-scorer table automatically retrieves goals from `PlayerGameweekStats`. Subsequent corrections replace previously recorded values.

To update the statistics, the system requires individual goal scorers from match reports. A team's final score alone is insufficient to determine individual player totals.

## Importing Match Results

To import the 16 results from the first two matchdays, run the following command from the project root with `DATABASE_URL` configured:

```bash
node --import tsx backend/scripts/import-match-results.ts
```

The script records only match scores and kickoff times. It validates consistency with results that have already been published and, within a single transaction, verifies that player prices, price history, fantasy statistics, points, and teams remain unchanged.

The script does not trigger a fantasy points recalculation or publish match reports.
