import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export function CategoriesPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Категории</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">В разработке</p>
      </CardContent>
    </Card>
  );
}
