import { Routes } from '@angular/router';
import { NotebooksComponent } from './notebooks/notebooks.component';
import { CuadernoComponent } from './cuaderno/cuaderno.component';
import { PanelComponent } from './panel/panel.component';
import { AnaliticaComponent } from './analitica/analitica.component';
import { FlujoComponent } from './flujo/flujo.component';
import { MapaComponent } from './mapa/mapa.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: NotebooksComponent, title: 'Cuadernos — VIP', canActivate: [authGuard] },
  { path: 'cuadernos/:id', component: CuadernoComponent, title: 'Cuaderno — VIP', canActivate: [authGuard] },
  { path: 'panel', component: PanelComponent, title: 'Panel — VIP', canActivate: [authGuard] },
  { path: 'analitica', component: AnaliticaComponent, title: 'Analítica — VIP', canActivate: [authGuard] },
  { path: 'flujo', component: FlujoComponent, title: 'Flujo — VIP', canActivate: [authGuard] },
  { path: 'mapa', component: MapaComponent, title: 'Mapa — VIP', canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
