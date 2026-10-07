import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

describe("Table", () => {
  it("renders header and row content in a semantic table", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow header>
            <TableHead>Name</TableHead>
            <TableHead justify="end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Jane Cooper</TableCell>
            <TableCell>Edit</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("Jane Cooper")).toBeInTheDocument();
  });
});
