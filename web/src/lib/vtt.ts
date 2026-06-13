export function parseVtt(text: string): VTTCue[] {
  const cues: VTTCue[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  if (lines[i]?.startsWith("WEBVTT")) i++;

  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;

    // Optional cue identifier line
    if (i + 1 < lines.length && !lines[i].includes("-->") && lines[i + 1].includes("-->")) {
      i++;
    }

    if (i >= lines.length || !lines[i].includes("-->")) {
      i++;
      continue;
    }

    const [startRaw, endPart] = lines[i].split("-->");
    const start = parseVttTime(startRaw.trim());
    const end = parseVttTime(endPart.trim().split(/\s+/)[0]);
    i++;

    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      textLines.push(lines[i].trim());
      i++;
    }

    const cueText = textLines.join("\n");
    if (cueText && end > start) {
      try {
        cues.push(new VTTCue(start, end, cueText));
      } catch {
        /* skip malformed cue */
      }
    }
  }

  return cues;
}

function parseVttTime(raw: string): number {
  const parts = raw.trim().split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return Number(m) * 60 + parseFloat(s);
  }
  return 0;
}
