import { Component, OnInit } from '@angular/core';
import { CloudSyncService } from '../../services/cloud-sync.service';

@Component({
  selector: 'oh-my-cloud-sync-svg',
  templateUrl: './cloud-sync.component.svg',
  styleUrls: ['./cloud-sync.component.scss']
})
export class CloudSyncComponent implements OnInit {
  isSyncing = false;

  constructor(public cloudSyncService: CloudSyncService) { }

  ngOnInit(): void {
    this.cloudSyncService.activity$.subscribe(v => {
      console.log(v);
    })
  }

}
