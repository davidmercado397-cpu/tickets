import { authHandlers } from './auth';
import { catalogHandlers } from './catalog';
import { employeeHandlers } from './employees';
import { notificationHandlers } from './notifications';
import { slaHandlers } from './sla';
import { ticketHandlers } from './tickets';
import { userHandlers } from './users';

export const handlers = [
  ...authHandlers,
  ...ticketHandlers,
  ...catalogHandlers,
  ...userHandlers,
  ...notificationHandlers,
  ...employeeHandlers,
  ...slaHandlers,
];
