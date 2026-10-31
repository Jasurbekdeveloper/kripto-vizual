import { Routes } from '@angular/router';
import { HomePage } from './pages/home.page';
import { AlgorithmPage } from './pages/algorithm.page';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'Kripto Vizual' },
  { path: 'algo/:id', component: AlgorithmPage, title: 'Kripto Vizual — algoritm' },
  { path: '**', redirectTo: '' },
];
