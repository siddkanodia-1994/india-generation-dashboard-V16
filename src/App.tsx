import React from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";

import ElectricityDashboard from "./ElectricityDashboard";
import RatedCapacity from "./RatedCapacity";
import LatestNews from "./LatestNews";
import LatestReports from "./LatestReports";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <Tabs>
          <div className="mt-2">
            <TabList>
              <Tab>Generation</Tab>
              <Tab>Peak Demand Met</Tab>
              <Tab>Supply</Tab>
              <Tab>Coal PLF</Tab>
              <Tab>RTM Prices</Tab>
              <Tab>Rated Capacity</Tab>
              <Tab>Latest News</Tab>
              <Tab>Latest Reports</Tab>
            </TabList>
          </div>

          {/* ===========================
              Generation (SUB-TABS)
              =========================== */}
          <TabPanel>
            <Tabs>
              <div className="mt-2">
                <TabList>
                  {/* 🔁 LABEL CHANGES ONLY */}
                  <Tab>Total</Tab>
                  <Tab>Thermal</Tab>
                  <Tab>Renewable</Tab>
                </TabList>
              </div>

              {/* Total = total */}
              <TabPanel>
                <ElectricityDashboard
                  type="generation"
                  title="India Electricity Generation Dashboard"
                  subtitle="Daily generation data, trends, and YoY/MoM analytics"
                  seriesLabel="Generation"
                  unitLabel="MU"
                  valueColumnKey="total"
                  defaultCsvPath="/data/generation.csv"
                  enableAutoFetch={true}
                  calcMode="sum"
                  valueDisplay={{
                    suffix: " MU",
                    decimals: 2,
                  }}
                />
              </TabPanel>

              {/* Thermal = coal (LABEL ONLY CHANGED) */}
              <TabPanel>
                <ElectricityDashboard
                  type="generation-coal"
                  title="India Electricity Generation Dashboard"
                  subtitle="Daily generation data, trends, and YoY/MoM analytics"
                  seriesLabel="Coal"
                  unitLabel="MU"
                  valueColumnKey="coal"
                  defaultCsvPath="/data/generation.csv"
                  enableAutoFetch={false}
                  calcMode="sum"
                  valueDisplay={{
                    suffix: " MU",
                    decimals: 2,
                  }}
                />
              </TabPanel>

              {/* Renewable = renewable */}
              <TabPanel>
                <ElectricityDashboard
                  type="generation-renewable"
                  title="India Electricity Generation Dashboard"
                  subtitle="Daily generation data, trends, and YoY/MoM analytics"
                  seriesLabel="Renewable"
                  unitLabel="MU"
                  valueColumnKey="renewable"
                  defaultCsvPath="/data/generation.csv"
                  enableAutoFetch={false}
                  calcMode="sum"
                  valueDisplay={{
                    suffix: " MU",
                    decimals: 2,
                  }}
                />
              </TabPanel>
            </Tabs>
          </TabPanel>

          {/* ===========================
              Peak Demand Met
              =========================== */}
          <TabPanel>
            <ElectricityDashboard
              type="demand"
              title="India Peak Demand Met Dashboard"
              subtitle="Daily peak demand met data (GW), trends, and YoY/MoM analytics"
              seriesLabel="Peak Demand Met"
              unitLabel="GW"
              valueColumnKey="demand_gwh"
              defaultCsvPath="/data/Peak Demand.csv"
              enableAutoFetch={false}
              calcMode="avg"
              valueDisplay={{
                suffix: " GW",
                decimals: 2,
              }}
            />
          </TabPanel>

          {/* ===========================
              Supply
              =========================== */}
          <TabPanel>
            <ElectricityDashboard
              type="supply"
              title="India Electricity Supply Dashboard"
              subtitle="Daily supply data, trends, and YoY/MoM analytics"
              seriesLabel="Supply"
              unitLabel="MU"
              valueColumnKey="supply_gwh"
              defaultCsvPath="/data/supply.csv"
              enableAutoFetch={false}
              calcMode="sum"
              valueDisplay={{
                suffix: " MU",
                decimals: 2,
              }}
            />
          </TabPanel>

          {/* ===========================
              Coal PLF
              =========================== */}
          <TabPanel>
            <ElectricityDashboard
              type="coal-plf"
              title="India Coal PLF Dashboard"
              subtitle="Coal PLF trends, period averages, and YoY/WoW analytics"
              seriesLabel="Coal PLF"
              unitLabel="%"
              valueColumnKey="coal_plf"
              defaultCsvPath="/data/Coal PLF.csv"
              enableAutoFetch={false}
              calcMode="avg"
              valueDisplay={{
                suffix: "%",
                decimals: 2,
              }}
            />
          </TabPanel>

          {/* ===========================
              RTM Prices
              =========================== */}
          <TabPanel>
            <ElectricityDashboard
              type="rtm-prices"
              title="India RTM Prices Dashboard"
              subtitle="RTM price trends, period averages, and YoY/WoW analytics"
              seriesLabel="RTM Prices"
              unitLabel="Rs/Unit"
              valueColumnKey="rtm_price"
              defaultCsvPath="/data/RTM Prices.csv"
              enableAutoFetch={false}
              calcMode="avg"
              valueDisplay={{
                suffix: " Rs/Unit",
                decimals: 2,
              }}
            />
          </TabPanel>

          {/* ===========================
              Rated Capacity
              =========================== */}
          <TabPanel>
            <RatedCapacity />
          </TabPanel>

          {/* ===========================
              Latest News
              =========================== */}
          <TabPanel>
            <LatestNews />
          </TabPanel>

          {/* ===========================
              Latest Reports
              =========================== */}
          <TabPanel>
            <LatestReports />
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
