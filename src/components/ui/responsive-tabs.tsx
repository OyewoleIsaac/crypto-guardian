import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface ResponsiveTabsProps {
  tabs: TabItem[];
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function ResponsiveTabs({
  tabs,
  defaultValue,
  children,
  className,
  value,
  onValueChange,
}: ResponsiveTabsProps) {
  const isMobile = useIsMobile();
  const [internalActiveTab, setInternalActiveTab] = React.useState(defaultValue);

  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalActiveTab;

  const handleChange = (next: string) => {
    if (!isControlled) {
      setInternalActiveTab(next);
    }
    onValueChange?.(next);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleChange}
      className={cn("space-y-6", className)}
    >
      {isMobile ? (
        <Select value={activeTab} onValueChange={handleChange}>
          <SelectTrigger className="w-full bg-muted/50">
            <SelectValue>
              <div className="flex items-center gap-2">
                {tabs.find((t) => t.value === activeTab)?.icon}
                {tabs.find((t) => t.value === activeTab)?.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <div className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      {children}
    </Tabs>
  );
}

export { TabsContent };
