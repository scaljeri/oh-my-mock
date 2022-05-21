import { Component, OnInit } from '@angular/core';
import { CloudSyncService } from '../../services/cloud-sync.service';

@Component({
  selector: 'oh-my-cloud-sync-page',
  templateUrl: './cloud-sync-page.component.html',
  styleUrls: ['./cloud-sync-page.component.scss']
})
export class CloudSyncPageComponent implements OnInit {

  constructor(private cloudSyncService: CloudSyncService) { }

  ngOnInit(): void {
    this.cloudSyncService.activity(true);
  }

  ngOnDestroy(): void {
    this.cloudSyncService.activity(false);
  }
}
