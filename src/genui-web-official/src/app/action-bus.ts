import { Injectable } from '@angular/core';
import { A2uiClientAction } from '@a2ui/web_core/v0_9';

// Renderer'ın ürettiği A2UI action mesajını App bileşenine ileten küçük köprü.
@Injectable({ providedIn: 'root' })
export class ActionBus {
  handler?: (action: A2uiClientAction) => void;
  emit(action: A2uiClientAction): void {
    this.handler?.(action);
  }
}
