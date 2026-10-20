// Small, dependency-free schema shared by the CLI and tests.
const string = { type: "string" };
const integer = { type: "integer" };
const array = (items, min = 0) => ({ type: "array", items, min });
const object = (fields, required = []) => ({ type: "object", fields, required });
const strings = array(string);
const snippet = object({
  path: string, startLine: integer, code: string, explanation: string, language: string,
}, ["path", "startLine", "code", "explanation"]);
const snippets = array(snippet);
const schema = object({
  title: string, tldr: array(string, 1), level: { ...string, values: ["junior", "mid", "senior"] },
  pitch: string, stack: strings,
  files: array(object({
    path: string, role: string, change: { ...string, values: ["added", "modified", "deleted"] },
  }, ["path"])),
  architecture: object({ mermaid: string, notes: strings }),
  flows: array(object({ name: string, mermaid: string, steps: strings }, ["name"])),
  patterns: array(object({
    name: string, category: string, what: string, here: string, where: strings, snippets,
    tradeoffs: object({ pros: strings, cons: strings }),
  }, ["name"])),
  snippets,
  challenges: array(object({
    title: string, task: string, where: strings, snippets,
    hints: array(string, 1), solution: string, checks: array(string, 1),
  }, ["title", "task", "hints", "solution", "checks"])),
  data: object({
    erMermaid: string,
    tables: array(object({ name: string, why: string }, ["name"])),
    cache: array(object({ key: string, ttl: string, strategy: string, why: string }, ["key"])),
  }),
  concepts: array(object({ term: string, explain: string }, ["term", "explain"])),
  seniorQuestions: array(object({ q: string, a: string }, ["q", "a"])),
  quiz: array(object({ q: string, options: array(string, 2), answer: integer, why: string }, ["q", "options", "answer"])),
  resources: array(object({ title: string, url: string, kind: string }, ["title", "url"])),
}, ["title", "tldr"]);

export function validate(data) {
  const errors = [];
  function visit(value, rule, path) {
    const label = path || "root";
    if (rule.type === "object") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${label}: must be a JSON object`);
        return;
      }
      for (const key of rule.required) {
        if (!Object.hasOwn(value, key)) errors.push(`${path ? path + "." : ""}${key}: required${rule.fields[key].type === "string" ? " string" : ""}`);
      }
      for (const [key, child] of Object.entries(rule.fields)) {
        if (Object.hasOwn(value, key)) visit(value[key], child, path ? `${path}.${key}` : key);
      }
    } else if (rule.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`${label}: must be an array`);
        return;
      }
      if (value.length < rule.min) errors.push(`${label}: need at least ${rule.min} entries`);
      value.forEach((item, i) => visit(item, rule.items, `${path}[${i}]`));
    } else if (rule.type === "integer") {
      if (!Number.isSafeInteger(value)) errors.push(`${label}: must be an integer`);
    } else if (typeof value !== "string" || !value.trim()) {
      errors.push(`${label}: required string`);
    } else if (rule.values && !rule.values.includes(value)) {
      errors.push(`${label}: must be one of ${rule.values.join(", ")}`);
    }
    if (path.endsWith(".startLine") && Number.isSafeInteger(value) && value < 1)
      errors.push(`${label}: must be at least 1`);
    if (path.endsWith(".url") && typeof value === "string") {
      try {
        if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error();
      } catch { errors.push(`${label}: must start with http(s):// and be a valid URL`); }
    }
  }
  visit(data, schema, "");
  if (Array.isArray(data?.quiz)) data.quiz.forEach((q, i) => {
    if (q && Array.isArray(q.options) && (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length))
      errors.push(`quiz[${i}].answer: must be an index into options`);
  });
  return errors;
}

// Soft length budget: lessons should read in about five minutes. Over-budget sections are
// warnings, not errors, so an old or unusual lesson still renders.
const limits = {
  tldr: 3, snippets: 2, files: 6, flows: 2, patterns: 3, concepts: 5,
  quiz: 3, seniorQuestions: 3, challenges: 3, resources: 3,
};
const skipped = new Set(["code", "mermaid", "erMermaid", "url", "path", "root", "generatedAt"]);
export function countWords(value, key) {
  if (skipped.has(key)) return 0;
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((n, x) => n + countWords(x), 0);
  if (value && typeof value === "object") return Object.entries(value).reduce((n, [k, x]) => n + countWords(x, k), 0);
  return 0;
}
export function budget(data) {
  const warnings = [];
  for (const [key, max] of Object.entries(limits))
    if (Array.isArray(data[key]) && data[key].length > max) warnings.push(`${key}: ${data[key].length} entries, budget is ${max}`);
  data.tldr.forEach((t, i) => {
    if (countWords(t) > 25) warnings.push(`tldr[${i}]: ${countWords(t)} words, budget is 25`);
  });
  data.flows?.forEach((f, i) => {
    if (f.steps?.length > 6) warnings.push(`flows[${i}].steps: ${f.steps.length} entries, budget is 6`);
  });
  if (data.architecture?.notes?.length > 3) warnings.push(`architecture.notes: ${data.architecture.notes.length} entries, budget is 3`);
  const words = countWords(data);
  if (words > 1100) warnings.push(`whole lesson: ${words} words of prose, budget is 1100 (about 5 minutes)`);
  return warnings;
}
