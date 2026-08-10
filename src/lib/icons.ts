/**
 * De iconen die de app gebruikt, op één plek.
 *
 * Alles komt uit Hugeicons (stroke, 1.5px). Door ze hier te hernoemen naar wat
 * ze in déze app betekenen, staat er in de componenten `icons.timer` in plaats
 * van `Timer02Icon`, en kun je een icoon vervangen zonder de rest aan te raken.
 */
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  ChefHatIcon,
  Clock01Icon,
  Delete02Icon,
  Dish01Icon,
  Idea01Icon,
  InboxIcon,
  LinkSquare02Icon,
  MinusSignIcon,
  PauseIcon,
  PlayIcon,
  PlusSignIcon,
  RefreshIcon,
  Settings01Icon,
  StarIcon,
  Tick02Icon,
  Timer02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import type { IconData } from "@/components/Icon";

export const icons = {
  back: ArrowLeft02Icon,
  next: ArrowRight02Icon,
  close: Cancel01Icon,
  recipes: ChefHatIcon,
  inbox: InboxIcon,
  clock: Clock01Icon,
  timer: Timer02Icon,
  play: PlayIcon,
  pause: PauseIcon,
  reset: RefreshIcon,
  done: Tick02Icon,
  delete: Delete02Icon,
  plate: Dish01Icon,
  tip: Idea01Icon,
  source: LinkSquare02Icon,
  minus: MinusSignIcon,
  plus: PlusSignIcon,
  settings: Settings01Icon,
  favorite: StarIcon,
  people: UserMultiple02Icon,
} satisfies Record<string, IconData>;
