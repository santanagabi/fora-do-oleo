import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const recipes = [
  {
    name: "Batata rústica com páprica",
    ingredients: ["batata", "azeite", "páprica", "sal"],
    temperatureC: 200,
    minutes: 22,
    steps: ["Corte as batatas em gomos e seque bem.", "Misture com azeite, páprica e sal.", "Asse a 200 °C por cerca de 22 minutos, mexendo na metade do tempo."],
  },
  {
    name: "Frango cítrico crocante",
    ingredients: ["frango", "limão", "farinha", "azeite", "sal"],
    temperatureC: 190,
    minutes: 18,
    steps: ["Tempere tiras de frango com limão e sal.", "Passe levemente na farinha e borrife azeite.", "Asse a 190 °C por 16–18 minutos, virando na metade. Confirme que o centro está completamente cozido."],
  },
  {
    name: "Banana com aveia e canela",
    ingredients: ["banana", "aveia", "canela", "mel"],
    temperatureC: 180,
    minutes: 8,
    steps: ["Corte a banana ao meio no comprimento.", "Polvilhe aveia e canela; finalize com um fio de mel.", "Asse a 180 °C por 6–8 minutos, até dourar."],
  },
  {
    name: "Brócolis tostado com parmesão",
    ingredients: ["brócolis", "parmesão", "azeite", "alho"],
    temperatureC: 190,
    minutes: 10,
    steps: ["Separe os floretes e seque bem.", "Misture com um pouco de azeite e alho.", "Asse a 190 °C por 8–10 minutos e finalize com parmesão."],
  },
];

const gramsPerCup: Record<string, number> = {
  acucar: 200,
  "açúcar": 200,
  farinha: 120,
  "farinha de trigo": 120,
  manteiga: 227,
  oleo: 218,
  "óleo": 218,
  leite: 245,
  aveia: 90,
  arroz: 185,
};

const volumeInMl: Record<string, number> = {
  ml: 1,
  xicara: 240,
  "xícara": 240,
  "colher de sopa": 15,
  "colher de chá": 5,
};

function findLocalRecipes(ingredients: string) {
  const terms = ingredients.toLocaleLowerCase("pt-BR").match(/[\p{L}\d]+/gu) ?? [];
  return recipes
    .map((recipe) => ({
      ...recipe,
      relevance: recipe.ingredients.filter((ingredient) => terms.some((term) => ingredient.includes(term) || term.includes(ingredient))).length,
    }))
    .filter((recipe) => recipe.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3)
    .map(({ name, ingredients, temperatureC, minutes, steps }) => ({ name, ingredients, temperatureC, minutes, steps }));
}

const mealDbIngredientMap: [string, string][] = [
  ["frango", "chicken"], ["chicken", "chicken"], ["batata", "potato"], ["potato", "potato"],
  ["carne", "beef"], ["beef", "beef"], ["porco", "pork"], ["pork", "pork"],
  ["peixe", "fish"], ["fish", "fish"], ["salmao", "salmon"], ["salmon", "salmon"],
  ["camarao", "prawn"], ["shrimp", "prawn"], ["ovo", "egg"], ["egg", "egg"],
  ["brocolis", "broccoli"], ["broccoli", "broccoli"], ["tomate", "tomato"], ["tomato", "tomato"],
  ["arroz", "rice"], ["rice", "rice"], ["queijo", "cheese"], ["cheese", "cheese"],
];
const mealDbNameSearchMap: [string, string][] = [
  ["nescau", "chocolate"], ["chocolate", "chocolate"], ["cacau", "chocolate"],
  ["bolo", "cake"], ["brownie", "brownie"], ["panqueca", "pancake"],
];

async function findPublicRecipe(pedido: string) {
  const normalized = pedido.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ingredient = mealDbIngredientMap.find(([term]) => normalized.includes(term))?.[1];
  const mealName = mealDbNameSearchMap.find(([term]) => normalized.includes(term))?.[1];
  if (!ingredient && !mealName) return null;

  const searchUrl = ingredient
    ? `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`
    : `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(mealName!)}`;
  const listResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(7000), next: { revalidate: 3600 } });
  if (!listResponse.ok) return null;
  const listData = await listResponse.json() as { meals?: { idMeal: string; strMeal: string }[] | null };
  const meal = listData.meals?.[0];
  if (!meal) return null;

  const detailResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`, { signal: AbortSignal.timeout(7000), next: { revalidate: 3600 } });
  if (!detailResponse.ok) return null;
  const detailData = await detailResponse.json() as { meals?: Record<string, string | null>[] | null };
  const details = detailData.meals?.[0];
  if (!details) return null;

  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = details[`strIngredient${i}`]?.trim();
    const measure = details[`strMeasure${i}`]?.trim();
    if (name) ingredients.push(`${measure ? `${measure} ` : ""}${name}`);
  }

  return {
    found: true,
    source: "TheMealDB",
    name: details.strMeal || meal.strMeal,
    ingredients,
    instructions: details.strInstructions || "A fonte não trouxe o modo de preparo.",
    url: details.strSource?.startsWith("https://") ? details.strSource : `https://www.themealdb.com/meal/${meal.idMeal}`,
    warning: "Esta receita é de uma base pública de pratos e não foi criada especificamente para air fryer. O modo de preparo e o idioma são os da fonte; não adapte tempo ou temperatura sem conferir.",
  };
}

export function createRecipeMcpServer() {
  const server = new McpServer({ name: "fora-do-oleo-receitas", version: "1.0.0" });

  server.registerTool(
    "buscar_receitas_air_fryer",
    {
      title: "Buscar receitas de air fryer",
      description: "Busca receitas testadas no catálogo pelo ingrediente ou pedido da pessoa. Use antes de inventar ou recomendar uma receita.",
      inputSchema: z.object({
        ingredientes: z.string().min(1).max(300).describe("Ingredientes ou pedido que a pessoa informou"),
      }),
    },
    async ({ ingredientes }) => {
      const matches = findLocalRecipes(ingredientes);

      return {
        content: [{
          type: "text",
          text: matches.length
            ? JSON.stringify(matches)
            : "Nenhuma receita do catálogo combina. Sugira uma receita simples usando o pedido da pessoa e deixe claro que ela é uma adaptação.",
        }],
      };
    },
  );

  server.registerTool(
    "buscar_receita_de_reserva",
    {
      title: "Buscar receita de reserva",
      description: "Quando o modelo de IA estiver indisponível, busca uma receita pública do TheMealDB pelo ingrediente ou usa uma receita do catálogo local.",
      inputSchema: z.object({ pedido: z.string().min(1).max(300) }),
    },
    async ({ pedido }) => {
      try {
        const publicRecipe = await findPublicRecipe(pedido);
        if (publicRecipe) return { content: [{ type: "text", text: JSON.stringify(publicRecipe) }] };
      } catch {
        // Continue to the bundled catalog if the public API is unavailable.
      }

      const localRecipe = findLocalRecipes(pedido)[0];
      if (!localRecipe) {
        return { content: [{ type: "text", text: JSON.stringify({ found: false, source: "catálogo local", message: "Não achei uma receita para esse pedido. Tente ingredientes como frango, batata, brócolis ou banana." }) }] };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({
          found: true,
          source: "Catálogo local do Fora do Óleo",
          name: localRecipe.name,
          ingredients: localRecipe.ingredients,
          instructions: localRecipe.steps.join("\n"),
          temperatureC: localRecipe.temperatureC,
          minutes: localRecipe.minutes,
          warning: "Sugestão do catálogo local para air fryer; tempos variam conforme o aparelho e o tamanho dos pedaços.",
        }) }],
      };
    },
  );

  server.registerTool(
    "converter_medida_culinaria",
    {
      title: "Converter medidas culinárias",
      description: "Converte gramas, quilogramas, mililitros, xícaras e colheres de sopa/chá. Para converter massa em volume (ou vice-versa), informe o ingrediente; medidas por volume são estimativas.",
      inputSchema: z.object({
        quantidade: z.number().positive(),
        unidade_origem: z.enum(["g", "kg", "ml", "xícara", "colher de sopa", "colher de chá"]),
        unidade_destino: z.enum(["g", "kg", "ml", "xícara", "colher de sopa", "colher de chá"]),
        ingrediente: z.string().optional(),
      }),
    },
    async ({ quantidade, unidade_origem, unidade_destino, ingrediente }) => {
      const massUnits: Record<string, number> = { g: 1, kg: 1000 };
      const sourceIsMass = unidade_origem in massUnits;
      const targetIsMass = unidade_destino in massUnits;
      const key = ingrediente?.toLocaleLowerCase("pt-BR").trim();
      const density = key ? gramsPerCup[key] : undefined;

      if (sourceIsMass !== targetIsMass && !density) {
        return {
          isError: true,
          content: [{ type: "text", text: "Para converter entre peso e volume, preciso saber o ingrediente. A densidade muda bastante de um ingrediente para outro." }],
        };
      }

      let milliliters: number;
      if (sourceIsMass) {
        const grams = quantidade * massUnits[unidade_origem];
        milliliters = density ? (grams / density) * 240 : grams;
      } else {
        milliliters = quantidade * volumeInMl[unidade_origem];
      }

      let converted: number;
      if (targetIsMass) {
        const grams = density ? (milliliters / 240) * density : milliliters;
        converted = grams / massUnits[unidade_destino];
      } else {
        converted = milliliters / volumeInMl[unidade_destino];
      }

      const rounded = Number(converted.toFixed(2));
      const caveat = sourceIsMass !== targetIsMass
        ? ` Estimativa para ${ingrediente}, usando xícara de 240 ml.`
        : "";
      return {
        content: [{ type: "text", text: `${quantidade} ${unidade_origem} = ${rounded} ${unidade_destino}.${caveat}` }],
      };
    },
  );

  return server;
}
