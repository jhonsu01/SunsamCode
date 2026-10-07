/**
 * Sunsam: el formulario MCP de upstream une los argumentos con espacios y los vuelve a separar por
 * espacios, lo que parte rutas como `C:\Users\Jhon Supelano\...` (habituales en extensiones .mcpb).
 * Aquí los argumentos con espacios o comillas se citan con comillas dobles; sin comillas el
 * comportamiento es idéntico al original.
 */
export function joinSunsamMcpArgs(args: readonly string[]): string {
  return args
    .map((arg) => (arg === "" || /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg))
    .join(" ");
}

export function splitSunsamMcpArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let hasToken = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (inQuotes && char === "\\" && input[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
      hasToken = true;
    } else if (!inQuotes && /\s/u.test(char)) {
      if (hasToken) args.push(current);
      current = "";
      hasToken = false;
    } else {
      current += char;
      hasToken = true;
    }
  }
  if (hasToken) args.push(current);
  return args;
}
