import { Button } from "@/components/ui/button";

export const TestButton = () => {
  return (
    <Button 
      variant="default" 
      size="lg"
      onClick={() => alert("Test button clicked!")}
      className="bg-red-500 hover:bg-red-600"
    >
      🚨 TEST BUTTON - CLICK ME! 🚨
    </Button>
  );
};