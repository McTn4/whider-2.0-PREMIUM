// Tipos globales de WHIDER para la comprobación progresiva con TypeScript (npm run typecheck).
// La app son scripts clásicos que cuelgan sus módulos de window.Whider; aquí se describen poco a poco.

/** Una tarea tal y como se guarda (js/core/store.js → cleanTask) */
interface WhiderTask {
  id: string;
  text: string;
  done: boolean;
  date?: string | null; // AAAA-MM-DD
  time?: string | null; // HH:MM
  listId?: string | null;
  highlight?: 'none' | 'star' | 'purple' | 'danger';
  repeat?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
  notes?: string;
  subtasks?: { text: string; done: boolean }[];
  createdAt: number;
  updatedAt?: number;
  doneOn?: string | null;
  doneAt?: number | null;
  spawnedId?: string | null;
  mine?: boolean;
}

/** Instantánea completa que se sincroniza con la nube (State.snapshot) */
interface WhiderSnapshot {
  v: 1;
  tasks: WhiderTask[];
  sync: {
    deleted: Record<string, number>;
    settingsAt?: number;
    listsAt?: number;
    profileAt?: number;
    resetAt?: number;
  };
  [campo: string]: unknown;
}

interface WhiderNamespace {
  [modulo: string]: any;
}

interface Window {
  Whider: WhiderNamespace;
  WhiderDescargas: any;
  WHIDER_CONFIG: any;
  /** Puente nativo de la app de escritorio (desktop/preload.js) */
  WhiderDesktop?: any;
  /** Puente nativo de la app de Android (WebAppInterface) */
  WhiderAndroid?: any;
}

interface Navigator {
  /** User-Agent Client Hints (Chromium); no existe en Safari ni Firefox */
  userAgentData?: { platform?: string; mobile?: boolean };
}

declare var Whider: WhiderNamespace;
