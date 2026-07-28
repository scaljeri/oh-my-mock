import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CloudSyncService } from '../../services/cloud-sync.service';

@Component({
  selector: 'oh-my-cloud-sync-page',
  templateUrl: './cloud-sync-page.component.html',
  styleUrls: ['./cloud-sync-page.component.scss']
})
export class CloudSyncPageComponent implements OnInit, OnDestroy {
  private cloudSyncService = inject(CloudSyncService);

  ngOnInit(): void {
    this.cloudSyncService.activity(true);
  }

  ngOnDestroy(): void {
    this.cloudSyncService.activity(false);
  }
}
