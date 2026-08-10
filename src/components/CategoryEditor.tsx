import { updateCategories } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import {
  CUISINE_SUGGESTIONS,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type MealType,
} from "@/lib/recipe/categories";

/**
 * De indeling van één recept bijstellen.
 *
 * Een `<details>` in plaats van een altijd zichtbaar formulier: normaal klopt
 * wat het model koos en wil je alleen de badges zien. Werkt zonder JavaScript —
 * het is een gewoon formulier met een server action.
 */
export function CategoryEditor({
  recipeId,
  mealTypes,
  cuisine,
}: {
  recipeId: string;
  mealTypes: MealType[];
  cuisine: string | null;
}) {
  return (
    <details className="category-editor">
      <summary>
        <Icon icon={icons.settings} size={16} />
        Indeling aanpassen
      </summary>

      <form action={updateCategories}>
        <input type="hidden" name="id" value={recipeId} />

        <fieldset>
          <legend className="eyebrow">Wanneer eet je dit?</legend>
          <div className="checks">
            {/* Vinkjes vermomd als chips: dezelfde vorm als de filters op het
                overzicht, en groot genoeg voor een duim. */}
            {MEAL_TYPES.map((type) => (
              <label key={type} className="check">
                <input
                  type="checkbox"
                  name="mealTypes"
                  value={type}
                  defaultChecked={mealTypes.includes(type)}
                />
                <span>{MEAL_TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow">Keuken</legend>
          {/* Een datalist in plaats van een select: suggesties waar je uit kunt
              kiezen, maar je kunt ook zelf iets typen dat er niet bij staat. */}
          <input
            type="text"
            name="cuisine"
            list="keukens"
            defaultValue={cuisine ?? ""}
            placeholder="Italiaans, Marokkaans, …"
            autoComplete="off"
          />
          <datalist id="keukens">
            {CUISINE_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </fieldset>

        <div className="row">
          <button type="submit">Indeling opslaan</button>
        </div>
      </form>
    </details>
  );
}
