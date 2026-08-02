import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { select } from 'd3-selection';
import { sankey } from 'd3-sankey';

export interface SankeyExpense {
  categoryName: string;
  totalAmount: number;
}

interface FlowNode {
  id: string;
  label: string;
  color: string;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-sankey',
  standalone: true,
  templateUrl: './sankey.component.html',
  styleUrl: './sankey.component.css',
})
export class SankeyComponent implements AfterViewInit, OnChanges {
  @Input() income = 0;
  @Input() expenses: SankeyExpense[] = [];
  @ViewChild('chart') chart?: ElementRef<SVGElement>;

  private viewReady = false;
  private readonly width = 960;
  private readonly height = 460;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['income'] || changes['expenses']) {
      this.render();
    }
  }

  private render(): void {
    if (!this.viewReady || !this.chart) {
      return;
    }

    const svg = select(this.chart.nativeElement);
    svg.selectAll('*').remove();

    const categoryExpenses = this.expenses.filter(
      (expense) => expense.totalAmount > 0 && expense.categoryName
    );
    const totalExpenses = categoryExpenses.reduce(
      (total, expense) => total + expense.totalAmount,
      0
    );
    const remaining = Math.max(this.income - totalExpenses, 0);
    const overspent = Math.max(totalExpenses - this.income, 0);
    const coveredRatio =
      totalExpenses > 0 ? Math.min(this.income / totalExpenses, 1) : 0;

    const nodes: FlowNode[] = [
      { id: 'income', label: 'Monthly income', color: '#2563eb' },
      ...(overspent > 0
        ? [{ id: 'unfunded', label: 'Unfunded expenses', color: '#f97316' }]
        : []),
      ...categoryExpenses.map((expense, index) => ({
        id: `expense-${index}`,
        label: expense.categoryName,
        color: '#e11d48',
      })),
    ];

    if (remaining > 0) {
      nodes.push({ id: 'remaining', label: 'Remaining', color: '#059669' });
    }
    const links: FlowLink[] = [];

    categoryExpenses.forEach((expense, index) => {
      const coveredAmount = expense.totalAmount * coveredRatio;
      const unfundedAmount = expense.totalAmount - coveredAmount;

      if (coveredAmount > 0) {
        links.push({
          source: 'income',
          target: `expense-${index}`,
          value: coveredAmount,
          color: '#fda4af',
        });
      }
      if (unfundedAmount > 0) {
        links.push({
          source: 'unfunded',
          target: `expense-${index}`,
          value: unfundedAmount,
          color: '#fdba74',
        });
      }
    });

    if (remaining > 0) {
      links.push({
        source: 'income',
        target: 'remaining',
        value: remaining,
        color: '#6ee7b7',
      });
    }
    if (!links.length) {
      svg
        .append('text')
        .attr('class', 'empty-chart')
        .attr('x', this.width / 2)
        .attr('y', this.height / 2)
        .text('Add income and expenses to see the cash flow');
      return;
    }

    const graph = sankey<FlowNode, FlowLink>()
      .nodeId((node) => node.id)
      .nodeWidth(22)
      .nodePadding(24)
      .extent([
        [30, 30],
        [this.width - 190, this.height - 30],
      ])({ nodes, links });

    const chartGroup = svg.append('g');
    chartGroup
      .append('g')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('class', 'flow-link')
      .attr('d', (link: any) => this.linkPath(link))
      .attr('stroke', (link: any) => link.color)
      .attr('stroke-width', (link: any) => Math.max(2, link.width))
      .append('title')
      .text((link: any) => `${link.source.label} to ${link.target.label}: ${this.formatAmount(link.value)}`);

    chartGroup
      .append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('class', 'flow-node')
      .attr('x', (node: any) => node.x0)
      .attr('y', (node: any) => node.y0)
      .attr('width', (node: any) => node.x1 - node.x0)
      .attr('height', (node: any) => Math.max(4, node.y1 - node.y0))
      .attr('fill', (node: any) => node.color)
      .append('title')
      .text((node: any) => `${node.label}: ${this.formatAmount(node.value)}`);

    chartGroup
      .append('g')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('class', 'node-label')
      .attr('x', (node: any) => (node.x0 < this.width / 2 ? node.x1 + 10 : node.x0 - 10))
      .attr('y', (node: any) => (node.y0 + node.y1) / 2)
      .attr('text-anchor', (node: any) => (node.x0 < this.width / 2 ? 'start' : 'end'))
      .text((node: any) => `${node.label} (${this.formatAmount(node.value)})`);
  }

  private linkPath(link: any): string {
    const sourceX = link.source.x1;
    const targetX = link.target.x0;
    const sourceY = link.y0;
    const targetY = link.y1;
    const midpoint = (sourceX + targetX) / 2;
    return `M${sourceX},${sourceY}C${midpoint},${sourceY} ${midpoint},${targetY} ${targetX},${targetY}`;
  }

  private formatAmount(value: number): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
