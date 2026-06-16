"use client"

// Đã loại bỏ Settings và Bell khỏi danh sách import
import { CreditCard, Moon, Sun, ChevronDown, LogOut, User, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onLogin?: () => void
  onRegister?: () => void
}

export function Header({ onLogin, onRegister }: HeaderProps) {
  const { currentUser, logout, openAuthModal, setCurrentPage, toggleDarkMode, isDarkMode, language, setLanguage } = useApp()

  const text = language === "vi" ? {
    description: "Hệ thống quản lý tài liệu học tập AI",
    light: "Chế độ sáng",
    dark: "Chế độ tối",
    profile: "Hồ sơ cá nhân",
    logout: "Đăng xuất",
    login: "Đăng nhập",
    register: "Đăng ký",
    controlPanel: "Bảng điều khiển",
  } : {
    description: "AI-powered study document management system",
    light: "Light mode",
    dark: "Dark mode",
    profile: "Profile",
    logout: "Log out",
    login: "Log in",
    register: "Sign up",
    controlPanel: "Control Panel",
  }

  const avatarInitials = currentUser?.displayName
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const isAdminAccount = currentUser?.role === "admin" || currentUser?.role === "sub-admin"

  const openPackages = () => {
    if (!currentUser) {
      openAuthModal("login")
      return
    }

    sessionStorage.setItem("profile-tab", "packages")
    setCurrentPage("profile")
    window.dispatchEvent(new Event("profile-tab-packages"))
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 sticky top-0 z-20">
      {/* Description Text */}
      <div className="hidden text-sm text-muted-foreground md:block">
        {text.description}
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <Button
          id="dark-mode-toggle"
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="text-muted-foreground hover:text-foreground"
          title={isDarkMode ? text.light : text.dark}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              {language.toUpperCase()}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage("vi")}>Tiếng Việt</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("en")}>English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!isAdminAccount && (
          <Button
            id="buy-plan-btn"
            size="sm"
            className="gap-1.5"
            onClick={openPackages}
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">{language === "vi" ? "Mua gói" : "Buy plan"}</span>
          </Button>
        )}

        {currentUser ? (
          <>
            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="user-menu"
                  className="flex items-center gap-2 rounded-full border border-border bg-muted px-2 py-1 text-sm transition-colors hover:bg-accent"
                >
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    currentUser.role === "admin" || currentUser.role === "sub-admin"
                      ? "bg-orange-500 text-white"
                      : "bg-primary text-primary-foreground"
                  )}>
                    {avatarInitials}
                  </div>
                  <span className="hidden max-w-[120px] truncate font-medium text-foreground sm:block">
                    {currentUser.displayName}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{currentUser.displayName}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                  <span className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                    currentUser.role === "admin" || currentUser.role === "sub-admin"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-primary/10 text-primary"
                  )}>
                    {currentUser.role === "admin" ? "Admin" : currentUser.role === "sub-admin" ? "Sub-admin" : "User"}
                  </span>
                </div>
                <DropdownMenuSeparator />
                {!isAdminAccount && (
                  <DropdownMenuItem id="go-profile" onClick={() => setCurrentPage("profile")}>
                    <User className="mr-2 h-4 w-4" />
                    {text.profile}
                  </DropdownMenuItem>
                )}
                {isAdminAccount && (
                  <DropdownMenuItem id="go-admin" onClick={() => setCurrentPage("admin")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {text.controlPanel}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem id="logout-btn" onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {text.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            {/* Login Button */}
            <Button
              id="login-btn"
              variant="ghost"
              size="sm"
              onClick={() => openAuthModal("login")}
            >
              {text.login}
            </Button>

            {/* Register Button */}
            <Button
              id="register-btn"
              size="sm"
              onClick={() => openAuthModal("register")}
            >
              {text.register}
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
