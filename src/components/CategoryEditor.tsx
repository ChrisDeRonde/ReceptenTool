import Link from "next/link";
import { updateCategories } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import {
  CUISINE_SUGGESTIONS,
  DIETS,
  DIET_HINTS,
  DIET_LABELS,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type Diet,
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
  diets,
}: {
  recipeId: string;
  mealTypes: MealType[];
  cuisine: string | null;
  diets: Diet[];
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

        <fieldset>
          <legend className="eyebrow">Dieet</legend>
          {/* De waarschuwing staat vóór de vinkjes en niet erna: wie hier iets
              aanzet moet weten wat hij aanzet voordat hij het doet. */}
          <p className="muted hint">
            Het model leidt dit af uit de ingrediënten, dus het is een
            inschatting. Prima om op te filteren, niet goed genoeg voor een
            allergie — zet wat iemand écht moet vermijden bij zijn naam in de{" "}
            <Link href="/instellingen">instellingen</Link>.
          </p>
          <div className="checks">
            {DIETS.map((diet) => (
              <label key={diet} className="check" title={DIET_HINTS[diet]}>
                <input
                  type="checkbox"
                  name="diets"
                  value={diet}
                  defaultChecked={diets.includes(diet)}
                />
                <span>{DIET_LABELS[diet]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="row">
          <button type="submit">Indeling opslaan</button>
        </div>
      </form>
    </details>
  );
}
