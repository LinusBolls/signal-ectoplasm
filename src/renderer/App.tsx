import { useEffect, useRef, useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Doughnut, Bar } from "react-chartjs-2";
import {
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import Chart from "chart.js/auto";

import './App.css';
import { useIpcQuery } from '../services/IpcParticipant';
import { ChartJSOrUndefined } from 'react-chartjs-2/dist/types';
import { ThreeDots } from 'react-loader-spinner';

Chart.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function ConversationsOverview() {

  const { isLoading: isLoadingConversations, data: conversationsRes} = useIpcQuery("GET_DASHBOARD_DATA")

  const chartRef = useRef<ChartJSOrUndefined<"bar", number[], string>>(null);

  if (isLoadingConversations) return <ThreeDots
    height="100" 
    width="100" 
    radius="9"
    color="white" 
    ariaLabel="loading-spinner"
    wrapperStyle={{}}
    visible={true}
   />

  const conversations = conversationsRes.conversations

  const footer = (tooltipItems: any) => {
    const item = tooltipItems[0];

    return item.label;

    return <a href={`/chat/${item.label}`}>{item.label}</a>;
  };

  const messageCountByUser = conversations.reduce(
    (prev, i) => ({ ...prev, [i.name]: i.numMessages }),
    {}
  );


  return (
    
    <>
      <Bar
        style={{
          width: "67vw",
        }}
        ref={chartRef}
        data={{
          labels: conversations.map((i) => i.name),
          datasets: [
            {
              label: "Amount of messages by conversation",
              data: conversations.map(
                (i) => i.numMessages
              ),
              backgroundColor: ["#E0AAFF", "#C77DFF", "#9D4EDD", "#7B2CBF"],
              borderColor: ["none"],
              borderWidth: 0,
            },
          ],
        }}
        options={{
          onClick: function (c, i) {
            console.log({ c, i });

            const e = i[0] as any;
            console.log(e);
          },

          interaction: {
            intersect: false,
            mode: "index",
          },
          plugins: {
            legend: {
              onClick: () => {
                console.log("hi");
              },
            },
            tooltip: {
              callbacks: {
                footer: footer,
              },
            },
          },
        }}
      />

      <div style={{ width: "33vw", height: "33vw" }}>
        <Doughnut
          data={{
            labels: Object.keys(messageCountByUser),
            datasets: [
              {
                label: "Amount of messages by conversation",
                data: Object.values(messageCountByUser),
                backgroundColor: ["#E0AAFF", "#C77DFF", "#9D4EDD", "#7B2CBF"],
                hoverOffset: 4,
              },
            ],
          }}
        />
      </div>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ConversationsOverview />} />
      </Routes>
    </Router>
  );
}
