import { useEffect, useRef } from "react";
import { imageUrl } from "../services/api";
import type { FantasyTeam, SquadEntry } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export const SHARE_POSTER_WIDTH = 1080;
export const SHARE_POSTER_HEIGHT = 1920;

type Copy = {
  title: string;
  brand: string;
  join: string;
  body: string;
  play: string;
  website: string;
};

function loadImage(source: string | undefined): Promise<HTMLImageElement | null> {
  if (!source) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    if (source.startsWith("http") && new URL(source, window.location.href).origin !== window.location.origin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function getStartingFive(team: FantasyTeam): SquadEntry[] {
  const starters = team.players.filter(entry => entry.status === "STARTER");
  const goalkeeper = starters.find(entry => entry.player.position === "GOALKEEPER");
  const field = starters.filter(entry => entry.player.position !== "GOALKEEPER");
  const slots: Array<SquadEntry | undefined> = Array.from({ length: 4 });
  const unassigned = field.filter(entry => entry.fieldSlot == null || entry.fieldSlot < 0 || entry.fieldSlot > 3);
  field.filter(entry => entry.fieldSlot != null && entry.fieldSlot >= 0 && entry.fieldSlot < 4).forEach(entry => { slots[entry.fieldSlot!] = entry; });
  for (let index = 0; index < slots.length; index += 1) if (!slots[index]) slots[index] = unassigned.shift();
  return [goalkeeper, ...slots].filter((entry): entry is SquadEntry => Boolean(entry));
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, weight = 700) {
  let size = initialSize;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 22) {
    size -= 2;
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  }
  return size;
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const shown = lines.slice(0, maxLines);
    let last = shown[maxLines - 1]!;
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    shown[maxLines - 1] = `${last.trimEnd()}…`;
    return shown;
  }
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, width: number, height: number) {
  const source = image as HTMLImageElement;
  const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(image, (source.naturalWidth - sw) / 2, (source.naturalHeight - sh) / 2, sw, sh, x, y, width, height);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]?.toLocaleUpperCase() ?? "").join("");
}

async function drawPoster(canvas: HTMLCanvasElement, team: FantasyTeam, copy: Copy) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const starters = getStartingFive(team);
  if (starters.length !== 5) throw new Error("STARTING_FIVE_REQUIRED");
  canvas.width = SHARE_POSTER_WIDTH;
  canvas.height = SHARE_POSTER_HEIGHT;

  const qrPromise = loadImage("/brand/fantasy-qr.png");
  const photoPromises = starters.map(entry => loadImage(imageUrl(entry.player.photoUrl)));
  const logoPromises = starters.map(entry => loadImage(imageUrl(entry.player.club.logoUrl)));
  const [qr, photos, logos] = await Promise.all([qrPromise, Promise.all(photoPromises), Promise.all(logoPromises)]);

  const background = ctx.createLinearGradient(0, 0, 0, SHARE_POSTER_HEIGHT);
  background.addColorStop(0, "#07152d");
  background.addColorStop(.55, "#0c2345");
  background.addColorStop(1, "#061126");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT);
  ctx.fillStyle = "rgba(255, 196, 0, .08)";
  ctx.beginPath(); ctx.arc(930, 180, 250, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(100, 1320, 330, 0, Math.PI * 2); ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffc400";
  ctx.font = "800 27px system-ui, sans-serif";
  ctx.letterSpacing = "5px";
  ctx.fillText(copy.brand, 540, 102, 940);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#ffffff";
  fitText(ctx, copy.title, 920, 80, 900);
  ctx.fillText(copy.title, 540, 205, 940);
  ctx.fillStyle = "#c7d5ea";
  ctx.font = "600 32px system-ui, sans-serif";
  ctx.fillText(team.name || copy.title, 540, 270, 900);

  const court = { x: 70, y: 330, w: 940, h: 950 };
  drawRoundedRect(ctx, court.x, court.y, court.w, court.h, 42);
  ctx.fillStyle = "#c79a39"; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(court.x, court.y, court.w, court.h, 42); ctx.clip();
  const wood = ctx.createLinearGradient(court.x, court.y, court.x + court.w, court.y + court.h);
  wood.addColorStop(0, "#d8ad51"); wood.addColorStop(.5, "#bc8e32"); wood.addColorStop(1, "#d3a448");
  ctx.fillStyle = wood; ctx.fillRect(court.x, court.y, court.w, court.h);
  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,.035)" : "rgba(2,16,38,.035)";
    ctx.fillRect(court.x + i * 100, court.y, 50, court.h);
  }
  ctx.strokeStyle = "rgba(255,255,255,.78)"; ctx.lineWidth = 5;
  ctx.strokeRect(court.x + 28, court.y + 28, court.w - 56, court.h - 56);
  ctx.beginPath(); ctx.moveTo(court.x + 28, court.y + court.h / 2); ctx.lineTo(court.x + court.w - 28, court.y + court.h / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(540, court.y + court.h / 2, 112, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(540, court.y + 5, 158, 0, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(540, court.y + court.h - 5, 158, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.restore();

  const locations = [
    { x: 540, y: 505 },
    { x: 300, y: 730 },
    { x: 780, y: 730 },
    { x: 300, y: 1030 },
    { x: 780, y: 1030 },
  ];
  const cardW = 255, cardH = 280;
  starters.forEach((entry, index) => {
    const { x: cx, y: cy } = locations[index]!;
    const x = cx - cardW / 2, y = cy - cardH / 2;
    ctx.save();
    ctx.shadowColor = "rgba(1,12,28,.35)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 12;
    drawRoundedRect(ctx, x, y, cardW, cardH, 28); ctx.fillStyle = "#081a35"; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = entry.isCaptain ? "#ffc400" : "rgba(255,255,255,.72)"; ctx.lineWidth = entry.isCaptain ? 6 : 3;
    drawRoundedRect(ctx, x, y, cardW, cardH, 28); ctx.stroke();

    const portraitX = cx - 65, portraitY = y + 16, portraitSize = 130;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, portraitY + portraitSize / 2, portraitSize / 2, 0, Math.PI * 2); ctx.clip();
    if (photos[index]) drawCover(ctx, photos[index]!, portraitX, portraitY, portraitSize, portraitSize);
    else {
      const fallback = ctx.createLinearGradient(portraitX, portraitY, portraitX + portraitSize, portraitY + portraitSize);
      fallback.addColorStop(0, "#344f75"); fallback.addColorStop(1, "#112744");
      ctx.fillStyle = fallback; ctx.fillRect(portraitX, portraitY, portraitSize, portraitSize);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "800 44px system-ui, sans-serif"; ctx.fillText(initials(entry.player.name), cx, portraitY + 82);
    }
    ctx.restore();

    ctx.fillStyle = "#ffc400"; ctx.textAlign = "center"; ctx.font = "800 23px system-ui, sans-serif";
    ctx.fillText(`#${entry.player.displayNumber ?? entry.player.number}`, cx, y + 173);
    if (entry.isCaptain) { ctx.textAlign = "right"; ctx.font = "700 20px system-ui, sans-serif"; ctx.fillText("★", x + cardW - 20, y + 34); }
    ctx.fillStyle = "#ffffff";
    const nameSize = fitText(ctx, entry.player.name, cardW - 24, 25, 800);
    ctx.font = `800 ${nameSize}px system-ui, sans-serif`;
    const nameLines = wrappedLines(ctx, entry.player.name, cardW - 24, 2);
    nameLines.forEach((line, lineIndex) => ctx.fillText(line, cx, y + 208 + lineIndex * 29, cardW - 24));
    const clubY = y + (nameLines.length > 1 ? 266 : 241);
    ctx.fillStyle = "#d5deed"; ctx.font = "600 17px system-ui, sans-serif";
    const logo = logos[index];
    if (logo) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx - 73, clubY - 5, 17, 0, Math.PI * 2); ctx.clip(); drawCover(ctx, logo, cx - 90, clubY - 22, 34, 34); ctx.restore();
    }
    const clubTextX = logo ? cx + 10 : cx;
    fitText(ctx, entry.player.club.name, cardW - 34, 17, 600);
    ctx.fillText(entry.player.club.name, clubTextX, clubY, cardW - 50);
    ctx.restore();
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffc400"; ctx.font = "900 38px system-ui, sans-serif";
  ctx.fillText(copy.join, 82, 1390, 620);
  ctx.fillStyle = "#ffffff"; ctx.font = "500 28px system-ui, sans-serif";
  const bodyLines = wrappedLines(ctx, copy.body, 585, 2);
  bodyLines.forEach((line, index) => ctx.fillText(line, 82, 1445 + index * 38));
  drawRoundedRect(ctx, 82, 1530, 400, 76, 20); ctx.fillStyle = "#ffc400"; ctx.fill();
  ctx.fillStyle = "#07152d"; ctx.textAlign = "center"; ctx.font = "900 27px system-ui, sans-serif"; ctx.fillText(copy.play, 282, 1579, 365);

  if (qr) ctx.drawImage(qr, 115, 0, 770, 770, 720, 1365, 240, 240);
  ctx.fillStyle = "#d5deed"; ctx.textAlign = "center"; ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(copy.website, 540, 1830, 980);
  ctx.fillStyle = "rgba(255,255,255,.48)"; ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText("FANTASY · FEMENINO · FUTSAL", 540, 1870);
}

export function ShareTeamCard({ team, onReady, onError }: {
  team: FantasyTeam;
  onReady: (blob: Blob) => void;
  onError: (error: Error) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLocale();
  const copy: Copy = {
    title: t("share.posterTitle"), brand: t("share.brand"), join: t("share.join"),
    body: t("share.body"), play: t("share.play"), website: t("share.website"),
  };
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void drawPoster(canvas, team, copy).then(() => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG_EXPORT_FAILED")), "image/png");
    })).then(blob => { if (!cancelled) onReady(blob); }).catch(error => { if (!cancelled) onError(error instanceof Error ? error : new Error("PNG_EXPORT_FAILED")); });
    return () => { cancelled = true; };
  }, [team, copy.title, copy.brand, copy.join, copy.body, copy.play, copy.website, onReady, onError]);

  return <div className="share-team-card"><canvas ref={canvasRef} width={SHARE_POSTER_WIDTH} height={SHARE_POSTER_HEIGHT} aria-label={team.name} /></div>;
}
