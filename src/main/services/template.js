export function renderTemplate(template, vars = {}) {
  return String(template ?? '')
    .replace(/\$\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))
    .trim();
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
