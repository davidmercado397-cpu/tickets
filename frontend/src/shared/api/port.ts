import type {
  Area,
  AreaCreateInput,
  AreaUpdateInput,
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
  Employee,
  EmployeeCreateInput,
  EmployeeListParams,
  EmployeeUpdateInput,
  LoginInput,
  Notification,
  Page,
  Priority,
  SessionUser,
  SlaPolicy,
  SlaUpsertInput,
  TicketDetail,
  TicketListItem,
  TicketListParams,
  TicketUpdateInput,
  User,
  UserCreateInput,
  UserUpdateInput,
} from './types';

/**
 * PUERTO de la API del Ticketing. Es el contrato del que dependen TODOS los hooks
 * de Query; su implementación (REST real / mock MSW) es intercambiable. La UI nunca
 * llama a `fetch` ni ve DTOs crudos: consume view models a través de este puerto.
 */
export interface TicketingApi {
  // auth
  login(input: LoginInput): Promise<{ accessToken: string; expiresIn: number }>;
  me(): Promise<SessionUser>;

  // tickets
  listTickets(params: TicketListParams): Promise<Page<TicketListItem>>;
  getTicket(id: string): Promise<TicketDetail>;
  updateTicket(id: string, patch: TicketUpdateInput): Promise<TicketDetail>;

  // catálogo: áreas
  listAreas(opts?: { onlyActive?: boolean }): Promise<Area[]>;
  createArea(input: AreaCreateInput): Promise<Area>;
  updateArea(id: string, input: AreaUpdateInput): Promise<Area>;
  disableArea(id: string): Promise<Area>;

  // catálogo: categorías
  listCategories(opts?: { onlyActive?: boolean }): Promise<Category[]>;
  createCategory(input: CategoryCreateInput): Promise<Category>;
  updateCategory(id: string, input: CategoryUpdateInput): Promise<Category>;
  disableCategory(id: string): Promise<Category>;

  // usuarios (solo admin)
  listUsers(): Promise<User[]>;
  createUser(input: UserCreateInput): Promise<User>;
  updateUser(id: string, input: UserUpdateInput): Promise<User>;

  // notificaciones (del usuario autenticado)
  listNotifications(opts?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  unreadCount(): Promise<number>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // empleados (solo admin)
  listEmployees(params: EmployeeListParams): Promise<Page<Employee>>;
  createEmployee(input: EmployeeCreateInput): Promise<Employee>;
  updateEmployee(document: string, input: EmployeeUpdateInput): Promise<Employee>;

  // políticas de SLA (admin)
  listSlaPolicies(): Promise<SlaPolicy[]>;
  upsertSlaPolicy(priority: Priority, input: SlaUpsertInput): Promise<SlaPolicy>;
}
