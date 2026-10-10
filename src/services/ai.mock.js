// Free, offline fallback so the demo works without any API key.
// Heuristic only: finds sentences like "Priya will send the report" or "I'll fix the login bug".

const ACTION =
  /^(?:(I)|([A-Z][a-z]+(?: [A-Z][a-z]+)?))\s+(?:will|should|needs to|need to|has to|must)\s+(.+?)[.!?]*$/;

export function mockInsights(transcript) {
  const summarySentences = [];
  const actionItems = [];

  for (const line of transcript.split(/\n+/)) {
    const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
    const speaker = m ? m[1].trim() : null;
    const text = (m ? m[2] : line).replace(/\bI'll\b/g, "I will").trim();

    for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
      if (summarySentences.length < 3) summarySentences.push(sentence);
      const a = sentence.match(ACTION);
      if (a) {
        actionItems.push({
          task: a[3].charAt(0).toUpperCase() + a[3].slice(1),
          assignee: a[1] ? speaker : a[2],
          dueDate: null,
        });
      }
    }
  }

  return {
    summary: summarySentences.join(" ") || "No content to summarize.",
    actionItems,
  };
}
