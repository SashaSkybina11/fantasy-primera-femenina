import assert from "node:assert/strict";
import test from "node:test";
import { defaultNotificationTemplates, hasCaptain, hasCompleteRoster, matchesNotificationAudience, normalizeNotificationLocale, notificationTemplate } from "../src/services/notifications.js";

const fullRoster = [...Array.from({ length: 2 }, () => ({ position: "GOALKEEPER" })), ...Array.from({ length: 8 }, () => ({ position: "FIELD_PLAYER" }))];

test("incomplete-team checks use the existing ten-player and position requirements", () => {
  assert.equal(hasCompleteRoster(fullRoster), true);
  assert.equal(hasCompleteRoster(fullRoster.slice(0, 9)), false);
  assert.equal(hasCompleteRoster([{ ...fullRoster[0]! }, ...Array.from({ length: 9 }, () => ({ position: "FIELD_PLAYER" }))]), false);
  assert.equal(matchesNotificationAudience({ team: { players: fullRoster.map(player => ({ ...player, status: "BENCH", isCaptain: false })) } }, "INCOMPLETE_TEAM"), false);
  assert.equal(matchesNotificationAudience({ team: null }, "INCOMPLETE_TEAM"), true);
});

test("captain reminders ignore captains on the bench and stop after a starter is chosen", () => {
  assert.equal(hasCaptain([{ status: "BENCH", isCaptain: true }]), false);
  assert.equal(matchesNotificationAudience({ team: { players: [{ position: "FIELD_PLAYER", status: "STARTER", isCaptain: false }] } }, "CAPTAIN_MISSING"), true);
  assert.equal(matchesNotificationAudience({ team: { players: [{ position: "FIELD_PLAYER", status: "STARTER", isCaptain: true }] } }, "CAPTAIN_MISSING"), false);
});

test("manual all-player announcements do not apply team-segment filters", () => {
  const complete = { team: { players: fullRoster.map(position => ({ ...position, status: "STARTER", isCaptain: true })) } };
  assert.equal(matchesNotificationAudience(complete, "ALL"), true);
  assert.equal(matchesNotificationAudience(complete, "USERS"), true);
});

test("every standard notification has four localized texts and existing internal routes", () => {
  for (const [type, translations] of Object.entries(defaultNotificationTemplates)) {
    for (const language of ["es", "uk", "en", "pt"] as const) {
      const content = translations[language];
      assert.ok(content.title, `${type}/${language} title`);
      assert.ok(content.message, `${type}/${language} message`);
      assert.ok(content.action, `${type}/${language} action`);
      assert.match(content.url, /^\/(?:purchase-players|my-team|leaderboard|friend-leagues|notifications)$/);
    }
  }
});

test("unsupported app languages fall back to English and supported messages interpolate safely", () => {
  assert.equal(normalizeNotificationLocale("fr-FR"), "en");
  assert.equal(normalizeNotificationLocale("pt-BR"), "pt");
  assert.match(notificationTemplate("MARKET_CLOSING", "en", { hours: "3" }).message, /3 hours/);
  assert.match(notificationTemplate("MARKET_CLOSING", "uk", { hours: "24" }).message, /24 год/);
});
