import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { msalConfigured } from './auth/msal.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'vip-web';

  /** MSAL solo está disponible cuando el entorno trae configuración Entra ID. */
  readonly authEnabled = msalConfigured();
  private readonly msal = inject(MsalService, { optional: true });

  username: string | null = null;

  ngOnInit(): void {
    if (!this.authEnabled || !this.msal) return;

    // Procesar la respuesta del redirect y fijar la cuenta activa.
    this.msal.handleRedirectObservable().subscribe({
      next: () => this.syncAccount(),
      error: () => this.syncAccount(),
    });
    this.syncAccount();
  }

  private syncAccount(): void {
    if (!this.msal) return;
    const accounts = this.msal.instance.getAllAccounts();
    if (accounts.length > 0) {
      this.msal.instance.setActiveAccount(accounts[0]);
      this.username = accounts[0].username;
    } else {
      this.username = null;
    }
  }

  login(): void {
    this.msal?.loginRedirect();
  }

  logout(): void {
    this.msal?.logoutRedirect();
  }
}
