import { Injectable } from '@angular/core';
import { AngularCatalog } from '@a2ui/angular';
import { cardDeclaration } from './card';
import { tableDeclaration } from './table';
import { chartDeclaration } from './chart';
import { formDeclaration } from './form';

// ÖZEL KATALOG: resmi renderer'a "bu catalogId'de şu 4 bileşen var" diyoruz.
// id, API'nin createSurface mesajında gönderdiği catalogId ile aynı olmalı (Catalog.cs).
// Katalogda olmayan bir bileşen gelirse resmi renderer onu çizmez.
@Injectable({ providedIn: 'root' })
export class GenUiCatalog extends AngularCatalog {
  constructor() {
    super('https://aigenerativeui.local/catalogs/genui-v1.json', '0.9', [
      cardDeclaration,
      tableDeclaration,
      chartDeclaration,
      formDeclaration,
    ]);
  }
}
