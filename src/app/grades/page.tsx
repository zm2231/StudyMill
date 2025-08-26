"use client";

import { Suspense } from "react";
import { Container, Loader, Center } from "@mantine/core";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GradesContent } from "./GradesContent";

export default function GradesPage() {
  return (
    <ProtectedRoute>
      <Suspense 
        fallback={
          <Container size="lg" py="lg">
            <Center style={{ minHeight: '60vh' }}>
              <Loader size="lg" />
            </Center>
          </Container>
        }
      >
        <GradesContent />
      </Suspense>
    </ProtectedRoute>
  );
}
