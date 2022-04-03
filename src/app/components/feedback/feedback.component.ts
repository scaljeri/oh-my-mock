import { Component } from '@angular/core';
import { githubIssueUrl } from '@shared/constants';

@Component({
  selector: 'oh-my-feedback',
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.scss']
})
export class FeedbackComponent {
  url = githubIssueUrl;
}
