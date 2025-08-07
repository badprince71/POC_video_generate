"use client"

import { useAuth } from "@/lib/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { User, LogOut, Settings } from "lucide-react"

export default function UserMenu() {
  const { user, signOut } = useAuth()

  if (!user) {
    return (
      <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
        <User className="h-4 w-4 mr-2" />
        Sign In
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
          <User className="h-4 w-4 mr-2" />
          {user.email || user.name || "User"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-white border-gray-200">
        <DropdownMenuLabel className="text-gray-900">My Account</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-200" />
        {/* <DropdownMenuItem className="text-gray-700 hover:bg-gray-50 cursor-pointer">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </DropdownMenuItem> */}
        {/* <DropdownMenuSeparator className="bg-gray-200" /> */}
        <DropdownMenuItem 
          onClick={signOut}
          className="text-red-600 hover:bg-red-50 cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 