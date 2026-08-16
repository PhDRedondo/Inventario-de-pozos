import { Routes } from '@angular/router';
import { NotebooksComponent } from './notebooks/notebooks.component';
import { CuadernoComponent } from './cuaderno/cuaderno.component';
import { PanelComponent } from './panel/panel.component';
import { AnaliticaComponent } from './analitica/analitica.component';

export const routes: Routes = [
  { path: '', component: NotebooksComponent, title: 'Cuadernos — VIP' },
  { path: 'cuadernos/:id', component: CuadernoComponent, title: 'Cuaderno — VIP' },
  { path: 'panel', component: PanelComponent, title: 'Panel — VIP' },
  { path: 'analitica', component: AnaliticaComponent, title: 'Analítica — VIP' },
  { path: '**', redirectTo: '' },
];
