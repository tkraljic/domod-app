'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Truck,
  Package,
  Building2,
  Calendar,
  Map,
  BarChart3,
  LogOut,
  ChevronDown,
  ScrollText,
  Users,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/app/actions/auth'

const navItems = [
  {
    group: 'Dostave',
    items: [
      { label: 'Plan dostava', href: '/dostave', icon: Truck },
      { label: 'Kalendar', href: '/kalendar', icon: Calendar },
      { label: 'Mapa', href: '/mapa', icon: Map },
    ],
  },
  {
    group: 'Katalog',
    items: [
      { label: 'Artikli', href: '/artikli', icon: Package },
      { label: 'Poslovnice', href: '/poslovnice', icon: Building2 },
      { label: 'Vozila', href: '/vozila', icon: Truck },
    ],
  },
  {
    group: 'Izvještaji',
    items: [
      { label: 'Statistike', href: '/izvjestaji', icon: BarChart3 },
    ],
  },
  {
    group: 'Administracija',
    adminOnly: true,
    items: [
      { label: 'Korisnici', href: '/korisnici', icon: Users },
      { label: 'Dnevnik', href: '/dnevnik', icon: ScrollText },
    ],
  },
]

type Props = {
  user: { fullName: string; role: string }
}

export function AppSidebar({ user }: Props) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-slate-700" />
          <span className="font-semibold text-slate-900">DOMOD</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navItems.map((group) => {
          if (group.adminOnly && user.role !== 'admin') return null
          return (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium uppercase text-slate-700">
                      {user.fullName.charAt(0)}
                    </div>
                    <div className="flex flex-col text-left leading-tight">
                      <span className="text-sm font-medium">{user.fullName}</span>
                      <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                    </div>
                    <ChevronDown className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-52">
                <DropdownMenuItem
                  render={
                    <form action={logout} className="w-full">
                      <button type="submit" className="flex w-full items-center gap-2 text-red-600">
                        <LogOut className="h-4 w-4" />
                        Odjava
                      </button>
                    </form>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
