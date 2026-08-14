import type { RouteChatPreviewModel } from './contracts';

const previewModel: RouteChatPreviewModel = {
  customers: [
    { id: 'route-alpha', name: 'Route Alpha', route: 'North route', summary: 'Preview conversation A', updatedAt: '10:20' },
    { id: 'route-bravo', name: 'Route Bravo', route: 'Central route', summary: 'Preview conversation B', updatedAt: '09:45' },
    { id: 'route-charlie', name: 'Route Charlie', route: 'South route', summary: 'Preview conversation C', updatedAt: 'Yesterday' }
  ],
  messagesByCustomer: {
    'route-alpha': [
      { id: 'alpha-1', sender: 'customer', body: 'Hello. I would like to confirm the next delivery.', sentAt: '10:12' },
      { id: 'alpha-2', sender: 'operator', body: 'Thank you. The route preview is ready for review.', sentAt: '10:20' }
    ],
    'route-bravo': [{ id: 'bravo-1', sender: 'customer', body: 'Please share the latest route plan.', sentAt: '09:45' }],
    'route-charlie': [{ id: 'charlie-1', sender: 'operator', body: 'Follow-up preview message.', sentAt: 'Yesterday' }]
  },
  detailsByCustomer: {
    'route-alpha': { nextAction: 'Confirm delivery window', responseSpeed: 'Within 24 hours', temperature: 'Warm', opportunityNote: 'Preview opportunity note', customerCategory: 'Route customer', contactChannel: 'Email' },
    'route-bravo': { nextAction: 'Share route plan', responseSpeed: 'Same day', temperature: 'Hot', opportunityNote: 'Preview opportunity note', customerCategory: 'Route customer', contactChannel: 'Chat' },
    'route-charlie': { nextAction: 'Follow up', responseSpeed: 'Within 48 hours', temperature: 'Cool', opportunityNote: 'Preview opportunity note', customerCategory: 'Route customer', contactChannel: 'Phone' }
  }
};

/** Explicit local preview data. This adapter never calls GAS or browser storage. */
export function getRouteChatPreviewModel(): RouteChatPreviewModel { return previewModel; }
