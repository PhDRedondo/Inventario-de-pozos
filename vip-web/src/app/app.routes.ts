import { Routes } from '@angular/router';
import { CuadernoComponent } from './cuaderno/cuaderno.component';

export const routes: Routes = [
  { path: '', component: CuadernoComponent, title: 'Cuaderno de inventario — VIP' },
  { path: '**', redirectTo: '' },
];
