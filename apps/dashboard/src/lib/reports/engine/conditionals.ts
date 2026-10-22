// Trechos condicionais nos textos: {{#se meta_roas > 3}}…{{senão}}…{{/se}}.
// Sinônimos em inglês ({{#if}} / {{else}} / {{/if}}) e blocos aninhados são aceitos.
// Texto mal fechado volta sem mudança, com um erro legível, para nada sumir da mensagem.

export type ConditionOperator = "<" | ">" | "<=" | ">=" | "==" | "!=";

/** Decide o bloco; quem chama resolve o valor da métrica (dado real, exemplo ou ausente). */
export type ConditionEvaluator = (slug: string, operator: ConditionOperator, threshold: number) => boolean;

type Block = { slug: string; operator: ConditionOperator; threshold: number; then: Node[]; otherwise: Node[] };
type Node = string | Block;
type Frame = { block: Block; inElse: boolean };

const TOKEN =
  /\{\{\s*(?:#(?:se|if)\s+([a-zA-Z0-9_.]+)\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:[.,]\d+)?)|(senão|senao|else)|\/(?:se|if))\s*\}\}/g;

export function compare(value: number, operator: ConditionOperator, threshold: number): boolean {
  switch (operator) {
    case "<":
      return value < threshold;
    case ">":
      return value > threshold;
    case "<=":
      return value <= threshold;
    case ">=":
      return value >= threshold;
    case "==":
      return value === threshold;
    case "!=":
      return value !== threshold;
  }
}

function parse(template: string): { nodes: Node[]; errors: string[] } {
  const root: Node[] = [];
  const stack: Frame[] = [];
  const errors: string[] = [];
  const target = (): Node[] => {
    const top = stack.at(-1);
    if (!top) return root;
    return top.inElse ? top.block.otherwise : top.block.then;
  };
  let last = 0;
  for (const match of template.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) target().push(template.slice(last, index));
    last = index + match[0].length;
    const [, slug, operator, threshold, elseWord] = match;
    if (slug) {
      const block: Block = { slug, operator: operator as ConditionOperator, threshold: Number(threshold.replace(",", ".")), then: [], otherwise: [] };
      target().push(block);
      stack.push({ block, inElse: false });
    } else if (elseWord) {
      const top = stack.at(-1);
      if (!top) errors.push("{{senão}} sem abertura {{#se …}}");
      else if (top.inElse) errors.push(`{{senão}} repetido no bloco de ${top.block.slug}`);
      else top.inElse = true;
    } else if (!stack.pop()) {
      errors.push("{{/se}} sem abertura {{#se …}}");
    }
  }
  if (last < template.length) target().push(template.slice(last));
  if (stack.length > 0) errors.push(`Condicional de ${stack[0].block.slug} sem fechamento {{/se}}`);
  return { nodes: root, errors };
}

function render(nodes: readonly Node[], evaluate: ConditionEvaluator): string {
  return nodes
    .map((node) =>
      typeof node === "string"
        ? node
        : render(evaluate(node.slug, node.operator, node.threshold) ? node.then : node.otherwise, evaluate),
    )
    .join("");
}

export function applyConditionals(template: string, evaluate: ConditionEvaluator): { text: string; errors: string[] } {
  if (!template.includes("{{")) return { text: template, errors: [] };
  const { nodes, errors } = parse(template);
  if (errors.length > 0) return { text: template, errors };
  return { text: render(nodes, evaluate), errors: [] };
}
