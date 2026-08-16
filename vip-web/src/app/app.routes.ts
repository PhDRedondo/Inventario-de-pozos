import { Routes } from '@angular/router';
import { CuadernoComponent } from './cuaderno/cuaderno.component';
import { PanelComponent } from './panel/panel.component';

export const routes: Routes = [
  { path: '', component: CuadernoComponent, title: 'Cuaderno de inventario — VIP' },
  { path: 'panel', component: PanelComponent, title: 'Panel — VIP' },
  { path: '**', redirectTo: '' },
];
