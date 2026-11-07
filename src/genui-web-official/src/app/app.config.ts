import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideA2Ui } from '@a2ui/angular';
import { A2uiClientAction } from '@a2ui/web_core/v0_9';
import { GenUiCatalog } from './catalog/genui-catalog';
import { ActionBus } from './action-bus';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // RESMİ A2UI RENDERER: kataloğu ve "action gelince ne yapılacak"ı veriyoruz.
    provideA2Ui(() => {
      const bus = inject(ActionBus);
      return {
        catalogs: [inject(GenUiCatalog)],
        actionHandler: (action: A2uiClientAction) => bus.emit(action),
      };
    }),
  ],
};
