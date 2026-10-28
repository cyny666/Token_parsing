// Filtered to the previously curated permission names, not a full Graph permission catalog.
// Source: microsoftgraph/microsoft-graph-devx-content, MIT License; see THIRD_PARTY_NOTICES.txt.
// Snapshot: 2026-10-22; source SHA256: 38fdce2ccb97a02fbe9e8446bcceb4ee0f76285a1e27f029b7c6a53c4ca42b16
// Delegated and application descriptions must never be used interchangeably.
export interface GraphPermissionDefinition {
  delegated?: { description: string };
  application?: { description: string };
}
export const GRAPH_PERMISSIONS: Record<string, GraphPermissionDefinition> = {
  "AccessReview.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下对组织中的访问审查、审阅者、决策和设置执行读取、更新和删除等操作。"
    },
    "delegated": {
      "description": "允许应用对组织中的已登录用户有权访问的访问审查、审阅者、决策和设置执行读取、更新和删除等操作。"
    }
  },
  "AppCatalog.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取应用目录中的应用。"
    },
    "delegated": {
      "description": "允许应用读取应用程序目录中的应用。"
    }
  },
  "AppCatalog.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下在应用目录中创建、读取、更新和删除应用。"
    },
    "delegated": {
      "description": "允许应用在应用目录中创建、读取、更新和删除应用。"
    }
  },
  "AppRoleAssignment.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下管理任何 API（包括 Microsoft Graph）的应用程序权限授予和任何应用的应用程序分配。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户管理任何 API（包括 Microsoft Graph）的应用程序权限授予和任何应用的应用程序分配。"
    }
  },
  "Application.Read.All": {
    "application": {
      "description": "允许此应用在没有登录用户的情况下读取所有应用程序和服务主体。"
    },
    "delegated": {
      "description": "允许此应用代表已登录用户读取应用程序和服务主体。"
    }
  },
  "Application.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下创建、读取、更新和删除应用程序和服务主体。 不允许管理授权。"
    },
    "delegated": {
      "description": "允许此应用代表已登录用户创建、读取、更新和删除应用程序和服务主体。不允许管理授权。"
    }
  },
  "AuditLog.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和查询你的日志活动。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和查询你的日志活动。"
    }
  },
  "Calendars.Read": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取所有日历的事件。"
    },
    "delegated": {
      "description": "允许应用读取用户日历中的事件。"
    }
  },
  "Calendars.Read.Shared": {
    "delegated": {
      "description": "允许应用读取用户可以访问的所有日历（包括委派日历和共享日历）中的事件。"
    }
  },
  "Calendars.ReadWrite": {
    "application": {
      "description": "允许应用在没有登录用户的情况下创建、读取、更新和删除所有日历的事件。"
    },
    "delegated": {
      "description": "允许应用创建、读取、更新和删除用户日历中的事件。"
    }
  },
  "Calendars.ReadWrite.Shared": {
    "delegated": {
      "description": "允许应用创建、读取、更新和删除组织用户有权访问的所有日历中的事件。这包括委派日历和共享日历。"
    }
  },
  "Channel.Create": {
    "application": {
      "description": "在没有登录用户的情况下创建任何团队中的频道。"
    },
    "delegated": {
      "description": "代表已登录用户在任何团队中创建频道。"
    }
  },
  "Channel.ReadBasic.All": {
    "application": {
      "description": "在没有登录用户的情况下读取所有频道名称、频道说明。"
    },
    "delegated": {
      "description": "代表已登录用户读取频道名称和频道说明。"
    }
  },
  "ChannelMessage.Send": {
    "delegated": {
      "description": "允许应用代表已登录的用户在 Microsoft Teams 中发送频道消息。"
    }
  },
  "Chat.Create": {
    "application": {
      "description": "允许应用在没有用户登录的情况下创建聊天。"
    },
    "delegated": {
      "description": "允许应用代表已登录的用户创建聊天。"
    }
  },
  "Chat.Read": {
    "delegated": {
      "description": "允许应用代表已登录用户对一对一或群组聊天线程执行读取操作。"
    }
  },
  "Chat.ReadBasic": {
    "delegated": {
      "description": "允许应用程序代表已登录的用户读取一对一和群组聊天线程的成员和说明。"
    }
  },
  "Chat.ReadWrite": {
    "delegated": {
      "description": "允许应用代表已登录用户对一对一或群组聊天线程执行读取和写入操作。"
    }
  },
  "ChatMessage.Send": {
    "delegated": {
      "description": "允许应用代表已登录用户在 Microsoft Teams 中发送一对一或群组聊天消息。"
    }
  },
  "CloudPC.Read.All": {
    "application": {
      "description": "允许应用程序在没有登录用户的情况下，读取云端电脑的属性。"
    },
    "delegated": {
      "description": "允许应用程序代表已登录用户读取云端电脑的属性。"
    }
  },
  "ConsentRequest.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取应用许可请求和审批，以及拒绝或批准这些请求。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取应用许可请求和审批，以及拒绝或批准这些请求。"
    }
  },
  "Contacts.Read": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取所有邮箱中的所有联系人。"
    },
    "delegated": {
      "description": "允许应用读取用户联系人。"
    }
  },
  "Contacts.ReadWrite": {
    "application": {
      "description": "允许应用在没有登录用户的情况下创建、读取、更新和删除所有邮箱中的全部联系人。"
    },
    "delegated": {
      "description": "允许应用创建、读取、更新和删除用户联系人。"
    }
  },
  "CrossTenantInformation.ReadBasic.All": {
    "application": {
      "description": "允许应用程序代表在无已登录用户的情况下，获取有关 Azure AD 生态系统中另一个目标租户的基本租户信息。"
    },
    "delegated": {
      "description": "允许应用程序代表已登录用户获取有关 Azure AD 生态系统中另一个目标租户的基本租户信息。"
    }
  },
  "DelegatedPermissionGrant.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下管理由任何 API（包括 Microsoft Graph）公开的委托权限的权限授予。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户管理由任何 API（包括 Microsoft Graph）公开的委托权限的权限授予。"
    }
  },
  "Device.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取组织设备的配置信息。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取组织设备的配置信息。"
    }
  },
  "DeviceManagementConfiguration.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取 Microsoft Intune 管理的设备配置的属性和设备符合性策略以及它们对组的分配情况。"
    },
    "delegated": {
      "description": "允许应用读取 Microsoft Intune 管理的设备配置的属性和设备符合性策略以及它们对组的分配情况。"
    }
  },
  "DeviceManagementConfiguration.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入 Microsoft Intune 管理的设备配置的属性和设备符合性策略以及它们对组的分配情况。"
    },
    "delegated": {
      "description": "允许应用读取和写入 Microsoft Intune 管理的设备配置的属性，以及设备合规性策略及其分配到组的情况。"
    }
  },
  "DeviceManagementManagedDevices.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取由 Microsoft Intune 管理的设备的属性。"
    },
    "delegated": {
      "description": "允许应用读取由 Microsoft Intune 管理的设备的属性。"
    }
  },
  "Directory.AccessAsUser.All": {
    "delegated": {
      "description": "允许应用以登录用户身份访问目录中的信息。"
    }
  },
  "Directory.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取组织目录中的数据（如用户、组和应用）。"
    },
    "delegated": {
      "description": "允许应用读取组织目录中的数据，如用户、组和应用。"
    }
  },
  "Directory.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入组织目录中的数据（如用户和组）。 不允许删除用户或组。"
    },
    "delegated": {
      "description": "允许应用读取和写入组织目录中的数据，如用户和组。 它不允许应用删除用户或组，或重置用户密码。"
    }
  },
  "Directory.Write.Restricted": {
    "application": {
      "description": "允许应用在无已登录用户的情况下，基于授予应用的其他权限来管理受限资源。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户基于授予应用的其他权限来管理受限资源。"
    }
  },
  "Domain.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取所有域属性。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取所有域属性。"
    }
  },
  "Domain.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入所有域属性。 还允许应用添加、验证和删除域。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和写入所有域属性。还允许应用添加、验证和删除域。"
    }
  },
  "EduRoster.ReadBasic": {
    "delegated": {
      "description": "允许应用读取组织名单中学校和班级结构属性的有限子集以及代表用户读取的有关用户属性的有限子集。 其中包括姓名、状态、教育角色、电子邮件地址和照片。"
    }
  },
  "EntitlementManagement.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取访问包及相关权利管理资源。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取访问包及相关权利管理资源。"
    }
  },
  "EntitlementManagement.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入访问包及相关权利管理资源。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户请求访问和管理访问包及相关权利管理资源。"
    }
  },
  "Family.Read": {
    "delegated": {
      "description": "允许应用读取你的家庭信息、成员及其基本个人资料。"
    }
  },
  "Files.Read": {
    "delegated": {
      "description": "允许应用读取登录用户的文件。"
    }
  },
  "Files.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取所有网站集中的全部文件。"
    },
    "delegated": {
      "description": "允许应用读取登录用户可以访问的所有文件。"
    }
  },
  "Files.ReadWrite": {
    "delegated": {
      "description": "允许应用读取、创建、更新和删除登录用户的文件。"
    }
  },
  "Files.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取、创建、更新和删除所有网站集中的全部文件。"
    },
    "delegated": {
      "description": "允许应用读取、创建、更新和删除登录用户可以访问的所有文件。"
    }
  },
  "Group.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取组属性和成员身份，并读取所有组的对话。"
    },
    "delegated": {
      "description": "允许应用代表登录用户列出组，并读取其属性以及所有组成员身份。 此外，还允许应用读取登录用户可以访问的所有组的日历、对话、文件和其他组内容。"
    }
  },
  "Group.ReadWrite.All": {
    "application": {
      "description": "允许应用创建组、读取所有组属性和成员身份、更新组属性和成员身份，以及删除组。还允许应用读取和写入对话。应用可以在没有登录用户的情况下执行所有这些操作。"
    },
    "delegated": {
      "description": "允许应用代表登录用户创建组并读取所有组属性和成员身份。 此外，还允许组所有者管理他们的组并允许组成员更新组内容。"
    }
  },
  "GroupMember.Read.All": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取所有组的成员身份和基本组属性。"
    },
    "delegated": {
      "description": "允许应用列出组、读取基本组属性以及读取登录的用户有权访问的所有组的成员身份。"
    }
  },
  "IdentityProvider.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入组织的标识（身份验证）提供程序的属性。"
    },
    "delegated": {
      "description": "允许应用代表用户读取和写入组织的标识（身份验证）提供程序的属性。"
    }
  },
  "IdentityRiskEvent.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取并更新组织的标识风险检测信息。更新操作包括确认风险事件检测。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和更新组织中所有用户的标识风险事件信息。 更新操作包括确认风险事件检测。"
    }
  },
  "IdentityRiskyUser.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取并更新组织的标识风险用户信息。 更新操作包括取消风险用户。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和更新组织中所有用户的标识风险用户信息。 更新操作包括取消风险用户。"
    }
  },
  "InformationProtectionPolicy.Read": {
    "delegated": {
      "description": "允许应用代表已登录用户读取信息保护敏感度标签和和标签策略设置。"
    }
  },
  "Mail.Read": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取所有邮箱中的邮件。"
    },
    "delegated": {
      "description": "允许应用读取已登录用户的邮箱。"
    }
  },
  "Mail.ReadWrite": {
    "application": {
      "description": "允许应用在没有登录用户的情况下创建、读取、更新和删除所有邮箱中的邮件。不包括邮件发送权限。"
    },
    "delegated": {
      "description": "允许应用创建、读取、更新和删除用户邮箱中的电子邮件。不包括邮件发送权限。"
    }
  },
  "Mail.Send": {
    "application": {
      "description": "允许应用在没有登录用户的情况下以任意用户身份发送邮件。"
    },
    "delegated": {
      "description": "允许应用以组织用户身份发送邮件。"
    }
  },
  "MailboxSettings.Read": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取用户邮箱设置。不包括邮件发送权限。"
    },
    "delegated": {
      "description": "允许应用读取用户的邮箱设置。不包括邮件发送权限。"
    }
  },
  "MailboxSettings.ReadWrite": {
    "application": {
      "description": "允许应用在没有登录用户的情况下创建、读取、更新和删除用户邮箱设置。不包括邮件发送权限。"
    },
    "delegated": {
      "description": "允许应用创建、读取、更新和删除用户邮箱设置。不包括邮件发送权限。"
    }
  },
  "Notes.Create": {
    "delegated": {
      "description": "允许应用代表已登录用户读取 OneNote 笔记本和分区标题并创建新的页面、笔记本和分区。"
    }
  },
  "Notes.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取组织中的所有 OneNote 笔记本。"
    },
    "delegated": {
      "description": "允许应用读取、共享和修改已登录用户在组织中有权访问的 OneNote 笔记本。"
    }
  },
  "Organization.Read.All": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取组织和相关资源。 相关资源包括订阅的 SKU 和租户品牌信息等内容。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取组织和相关资源。 相关资源包括订阅的 SKU 和租户品牌信息等内容。"
    }
  },
  "People.Read": {
    "delegated": {
      "description": "允许应用读取登录用户相关人员的排名列表。该列表包括当地联系人、来自社交网络的联系人、您所在组织的目录以及来自最近通信（例如电子邮件和 Skype）的人员。"
    }
  },
  "People.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取任何用户的相关人员得分列表。该列表可包括当地联系人、社交网络或你所在组织目录中的联系人以及来自最近通信（例如电子邮件和 Skype）的人员。"
    },
    "delegated": {
      "description": "允许应用读取已登录用户或已登录用户组织中的其他用户的相关人员得分列表。该列表可包括当地联系人、社交网络或你所在组织目录中的联系人以及来自最近通信（例如电子邮件和 Skype）的人员。"
    }
  },
  "Policy.Read.All": {
    "application": {
      "description": "允许应用无需登录的用户即可读取你所在组织的所有策略。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取你的组织的策略。"
    }
  },
  "Policy.ReadWrite.ApplicationConfiguration": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取和写入组织的所有应用程序配置策略。 这包括 activityBasedTimeoutPolicy、claimsMappingPolicy、homeRealmDiscoveryPolicy、tokenIssuancePolicy 和 tokenLifetimePolicy 等策略。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和写入组织的应用程序配置策略。 这包括 activityBasedTimeoutPolicy、claimsMappingPolicy、homeRealmDiscoveryPolicy、tokenIssuancePolicy 和 tokenLifetimePolicy 等策略。"
    }
  },
  "Policy.ReadWrite.AuthenticationFlows": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入所有租户身份验证流策略。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和写入身份验证流策略。"
    }
  },
  "Policy.ReadWrite.AuthenticationMethod": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入所有租户身份验证方法策略。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和写入身份验证方法策略。"
    }
  },
  "Policy.ReadWrite.Authorization": {
    "application": {
      "description": "允许应用无需登录的用户即可读取和写入你所在组织的授权策略。例如，授权策略可以控制现有用户角色默认拥有的某些权限。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和写入你组织的授权策略。 例如，授权策略可以控制现有用户角色默认拥有的某些权限。"
    }
  },
  "Policy.ReadWrite.ConditionalAccess": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取和写入你组织的条件访问策略。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和写入你的组织的条件访问策略。"
    }
  },
  "Policy.ReadWrite.MobilityManagement": {
    "delegated": {
      "description": "允许应用程序代表已登录用户读取和写入贵组织的移动设备管理策略。 例如，移动设备管理策略可以为指定的移动设备管理程序设置注册范围。"
    }
  },
  "Presence.Read.All": {
    "delegated": {
      "description": "允许应用代表已登录用户读取目录中所有用户的状态信息。状态信息包括活动、可用性、状态备注、日历外出邮件、时区和位置。"
    }
  },
  "PrinterShare.ReadBasic.All": {
    "delegated": {
      "description": "允许应用程序代表已登录的用户读取有关打印机共享的基本信息。不允许读取访问控制信息。"
    }
  },
  "Reports.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取所有服务使用情况报告。 提供使用情况报告的服务包括 Office 365 和 Azure Active Directory。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取所有服务使用情况报告。 提供使用情况报告的服务包括 Office 365 和 Azure Active Directory。"
    }
  },
  "RoleManagement.Read.Directory": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取公司目录的基于角色的访问控制 (RBAC) 设置。 这包括读取目录角色模板、目录角色和成员身份。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取公司目录的基于角色的访问控制 (RBAC) 设置。 这包括读取目录角色模板、目录角色和成员身份。"
    }
  },
  "RoleManagement.ReadWrite.Directory": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取并管理公司目录的基于角色的访问控制 (RBAC) 设置。这包括实例化目录角色和管理目录角色成员身份，以及读取目录角色模板、目录角色和成员身份。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取和管理公司目录的基于角色的访问控制 (RBAC) 设置。这包括实例化目录角色和管理目录角色成员身份，以及读取目录角色模板、目录角色和成员身份。"
    }
  },
  "SecurityEvents.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取组织的安全事件。还允许应用更新安全事件中的可编辑属性。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户读取组织的安全事件。还允许应用代表已登录用户更新安全事件中的可编辑属性。"
    }
  },
  "ServicePrincipalEndpoint.Read.All": {
    "application": {
      "description": "允许应用程序读取服务主体终结点"
    },
    "delegated": {
      "description": "允许应用程序读取服务主体终结点"
    }
  },
  "Sites.FullControl.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下具有对所有网站集的完全控制权限。"
    },
    "delegated": {
      "description": "允许应用程序代表已登录用户具有对所有网站集的完全控制权限。"
    }
  },
  "Sites.Read.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下读取所有网站集中的文档和列表项。"
    },
    "delegated": {
      "description": "允许应用程序代表登录用户读取文档，并列出所有网站集中的项目"
    }
  },
  "Sites.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下创建、读取、更新和删除所有网站集中的文档和列表项。"
    },
    "delegated": {
      "description": "允许应用程序代表登录用户编辑或删除所有网站集中的文档和列表项。"
    }
  },
  "Tasks.ReadWrite": {
    "delegated": {
      "description": "允许该应用创建、读取、更新和删除已登录用户的任务和任务列表，包括与用户共享的任何内容。"
    }
  },
  "Team.ReadBasic.All": {
    "application": {
      "description": "在没有用户登录的情况下获取所有团队列表。"
    },
    "delegated": {
      "description": "代表已登录用户读取频道的名称和说明。"
    }
  },
  "TeamMember.ReadWrite.All": {
    "application": {
      "description": "在没有用户登录的情况下从所有团队中添加和删除成员。还允许更改团队成员的角色，例如从所有者到非所有者。"
    },
    "delegated": {
      "description": "代表已登录用户从团队中添加和删除成员。还允许更改成员的角色，例如从所有者到非所有者。"
    }
  },
  "TeamsAppInstallation.ReadForTeam": {
    "delegated": {
      "description": "允许应用读取安装在已登录用户可访问的团队中的 Teams 应用。不允许读取特定于应用程序的设置。"
    }
  },
  "TeamsAppInstallation.ReadWriteForTeam": {
    "delegated": {
      "description": "允许应用在已登录用户可以访问的团队中读取、安装、更新和卸载 Teams 应用。不允许读取特定于应用程序的设置。"
    }
  },
  "TeamsTab.Create": {
    "application": {
      "description": "允许用户在没有登录用户的情况下在 Microsoft Teams 中的任何团队内创建选项卡。这不会授予在选项卡创建后读取、修改或删除这些选项卡的权限，也不会授予访问选项卡中的内容的权限。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户在 Microsoft Teams 中的任何团队内创建选项卡。这不会授予在选项卡创建后读取、修改或删除这些选项卡的权限，也不会授予访问选项卡中的内容的权限。"
    }
  },
  "User.Export.All": {
    "application": {
      "description": "允许应用导出数据（如客户内容或系统生成的日志）、是否与公司内的任何用户关联、特权用户（如公司管理员）使用应用的时间。"
    },
    "delegated": {
      "description": "允许应用导出数据（如客户内容或系统生成的日志）、是否与公司内的任何用户关联、特权用户（如公司管理员）使用应用的时间。"
    }
  },
  "User.Invite.All": {
    "application": {
      "description": "允许应用在没有登录用户的情况下将来宾用户邀请到组织。"
    },
    "delegated": {
      "description": "允许应用代表已登录用户将来宾用户邀请到组织。"
    }
  },
  "User.ManageIdentities.All": {
    "application": {
      "description": "允许应用程序在没有登录用户的情况下读取、更新和删除与用户帐户相关联的标识。这控制用户可以使用哪些标识进行登录。"
    },
    "delegated": {
      "description": "允许应用读取、更新和删除与登录用户有权访问的用户帐户相关联的标识。这控制用户可以使用哪些标识进行登录。"
    }
  },
  "User.Read": {
    "delegated": {
      "description": "允许用户登录应用，并允许应用读取登录用户的个人资料。它还允许应用读取登录用户的基本公司信息。"
    }
  },
  "User.Read.All": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取用户配置文件。"
    },
    "delegated": {
      "description": "允许应用代表登录用户读取组织中其他用户的整套个人资料属性、下属和经理。"
    }
  },
  "User.ReadBasic.All": {
    "delegated": {
      "description": "允许应用代表登录用户读取组织中其他用户的一套基本个人资料属性。其中包括显示名称、名字和姓氏、电子邮件地址和照片。"
    }
  },
  "User.ReadWrite": {
    "delegated": {
      "description": "允许应用读取个人资料。此外，它还允许应用代表你更新个人资料。"
    }
  },
  "User.ReadWrite.All": {
    "application": {
      "description": "允许应用在没有已登录用户的情况下读取和更新用户个人资料。"
    },
    "delegated": {
      "description": "允许应用代表登录用户读取和写入组织中其他用户的整套个人资料属性、下属和经理。"
    }
  },
  "UserAuthenticationMethod.Read": {
    "delegated": {
      "description": "允许该应用读取已登录用户的身份验证方法，包括电话号码和 Authenticator 应用设置。这不允许该应用查看已登录用户的密码之类的机密信息，也无法登录或以其他方式使用已登录用户的身份验证方法。"
    }
  },
  "UserAuthenticationMethod.ReadWrite": {
    "delegated": {
      "description": "允许该应用读取和写入已登录用户的身份验证方法，包括电话号码和 Authenticator 应用设置。                      这不允许该应用查看已登录用户的密码之类的机密信息，也                      无法登录或以其他方式使用已登录用户的身份验证方法。"
    }
  },
  "UserAuthenticationMethod.ReadWrite.All": {
    "application": {
      "description": "允许此应用程序读取和写入组织中所有用户的身份验证方法，无已登录用户。                      身份验证方法包括用户的电话号码和 Authenticator 应用设置之类的内容。这不允许该应用查看密码之类的机密信息，也无法登录或以其他方式使用身份验证方法"
    },
    "delegated": {
      "description": "允许此应用读取和写入已登录用户有权访问的组织中所有用户的身份验证方法。                      身份验证方法包括用户的电话号码和 Authenticator 应用设置之类的内容。这                      不允许该应用查看密码之类的机密信息，也无法登录或以其他方式使用身份验证方法。"
    }
  },
  "email": {
    "delegated": {
      "description": "允许应用读取用户的主电子邮件地址"
    }
  },
  "offline_access": {
    "delegated": {
      "description": "允许应用查看和更新你为其提供访问权限的数据，即使用户当前未使用此应用。这不会为应用提供任何其他权限。"
    }
  },
  "openid": {
    "delegated": {
      "description": "允许用户以其工作或学校帐户登录应用，并允许应用查看用户的基本个人资料信息。"
    }
  },
  "profile": {
    "delegated": {
      "description": "允许应用查看用户的基本配置文件 (例如，名称、图片、用户名、电子邮件地址)"
    }
  }
};
